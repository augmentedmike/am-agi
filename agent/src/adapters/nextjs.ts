import { spawn as _spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import type { ClaudeResult, ClaudeUsage } from "../loop/types";

type SpawnFn = (cmd: string, args: string[], opts: SpawnOptions) => ChildProcess;

// Serialize claude process startup to prevent concurrent OAuth token refresh
// races. All invocations share this lock. Each caller holds it for
// STARTUP_HOLD_MS after spawning, giving the process time to auth before the
// next one starts. Processes then run fully concurrently after that.
let startupLock: Promise<void> = Promise.resolve();
const STARTUP_HOLD_MS = 4_000;

/**
 * Thrown when the Claude CLI reports an authentication failure
 * (stderr contains "Not logged in").
 *
 * Callers that want to distinguish auth failures from other errors can
 * catch this specifically and prompt the user to run /login.
 */
export class AuthError extends Error {
  constructor(message = "Claude auth expired") {
    super(message);
    this.name = "AuthError";
  }
}

export interface StreamEvent {
  type: string;
  subtype?: string;
  message?: { role?: string; content?: unknown[] };
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface InvokeOptions {
  /** Path to the claude executable. Defaults to "claude". */
  claudePath?: string;
  /** Optional system prompt passed via --system-prompt to the Claude CLI. */
  systemPrompt?: string;
  /** Optional model override (e.g. "claude-haiku-4-5-20251001"). Defaults to Claude's own default. */
  model?: string;
  /**
   * Called for each parsed stream-json event as they arrive.
   * When provided, uses `--output-format stream-json` instead of `json`.
   */
  onEvent?: (event: StreamEvent) => void;
  /**
   * Path to an MCP config JSON file. When set, `--mcp-config <path>` is
   * appended to the Claude CLI args so the subprocess can use MCP servers.
   */
  mcpConfigPath?: string;
  /**
   * Override the spawn implementation. Defaults to `child_process.spawn`.
   * Primarily useful for testing without global module mocking.
   */
  spawnFn?: SpawnFn;
}

/**
 * Resolve an executable using PATH lookup via `which` (Node.js-compatible,
 * no Bun APIs). Falls back to the name as-is if `which` fails.
 */
function resolveExecutable(name: string, pathEnv?: string): string {
  try {
    const env = pathEnv ? { ...process.env, PATH: pathEnv } : process.env;
    return execFileSync("which", [name], { env, encoding: "utf8" }).trim();
  } catch {
    return name;
  }
}

/**
 * INVOKE CLAUDE step — run the Claude CLI with the given prompt, streaming
 * stdout/stderr through to the parent process.
 *
 * Node.js-compatible version: uses `child_process.spawn` instead of
 * `Bun.spawn`/`Bun.which`. Suitable for use in Next.js API routes.
 *
 * Uses `--dangerously-skip-permissions`. Output format is `json` by default,
 * or `stream-json` when `onEvent` is provided (events are parsed and forwarded).
 * Sets `cwd` to `workDir` so Claude operates inside the worktree.
 *
 * Throws `AuthError` if stderr contains "Not logged in".
 */
export async function invokeClaude(
  workDir: string,
  prompt: string,
  options: InvokeOptions = {},
): Promise<ClaudeResult> {
  const claudePath = options.claudePath ?? "claude";
  const streaming = !!options.onEvent;

  // Acquire startup lock
  let releaseLock!: () => void;
  const prevLock = startupLock;
  startupLock = new Promise<void>(resolve => { releaseLock = resolve; });
  await prevLock;

  // Strip Claude Code session markers so the subprocess is not treated as a
  // nested invocation (CLAUDECODE=1 causes auth to fail in sub-processes).
  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, ...spawnEnv } = process.env;

  // Resolve the full path using PATH lookup (no Bun.which)
  const resolvedClaude = resolveExecutable(claudePath, spawnEnv.PATH);

  const outputFormat = streaming ? "stream-json" : "json";
  const args = ["--dangerously-skip-permissions", "-p", prompt, "--output-format", outputFormat];
  if (streaming) args.push("--verbose");
  if (options.systemPrompt) args.unshift("--system-prompt", options.systemPrompt);
  if (options.model) args.unshift("--model", options.model);
  if (options.mcpConfigPath) args.push("--mcp-config", options.mcpConfigPath);

  const spawnImpl = options.spawnFn ?? _spawn;
  const proc = spawnImpl(resolvedClaude, args, {
    cwd: workDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: spawnEnv as NodeJS.ProcessEnv,
  });

  // Hold the lock for STARTUP_HOLD_MS then release so the next spawn can start
  setTimeout(releaseLock, STARTUP_HOLD_MS);

  const decoder = new TextDecoder();
  let lineBuffer = "";

  // Set up close listener BEFORE awaiting stdout/stderr so we don't miss the
  // event if the process emits "close" in the same tick as the stream "end"s.
  const exitCodePromise = new Promise<number>((resolve, reject) => {
    proc.on("close", resolve);
    proc.on("error", reject);
  });

  const [stdoutChunks, stderrChunks] = await Promise.all([
    new Promise<Buffer[]>((resolve, reject) => {
      const chunks: Buffer[] = [];
      proc.stdout!.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        process.stdout.write(chunk);
        if (streaming && options.onEvent) {
          lineBuffer += decoder.decode(chunk, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try { options.onEvent(JSON.parse(line) as StreamEvent); } catch { /* skip malformed */ }
          }
        }
      });
      proc.stdout!.on("end", () => {
        // Flush remaining buffer
        if (streaming && options.onEvent && lineBuffer.trim()) {
          try { options.onEvent(JSON.parse(lineBuffer) as StreamEvent); } catch {}
        }
        resolve(chunks);
      });
      proc.stdout!.on("error", reject);
    }),
    new Promise<Buffer[]>((resolve, reject) => {
      const chunks: Buffer[] = [];
      proc.stderr!.on("data", (chunk: Buffer) => chunks.push(chunk));
      proc.stderr!.on("end", () => resolve(chunks));
      proc.stderr!.on("error", reject);
    }),
  ]);

  const exitCode = await exitCodePromise;

  const rawOutput = stdoutChunks.map(c => c.toString("utf8")).join("");
  const stderrText = stderrChunks.map(c => c.toString("utf8")).join("");

  if (stderrText) {
    process.stderr.write(stderrText);
  }

  if (stderrText.includes("Not logged in")) {
    throw new AuthError("Claude auth expired — run /login to restore");
  }

  if (exitCode !== 0) {
    const authPatterns = [
      "authentication",
      "unauthorized",
      "401",
      "token expired",
      "oauth",
      "invalid api key",
      "api key",
      "credentials",
    ];
    const lowerStderr = stderrText.toLowerCase();
    if (authPatterns.some((p) => lowerStderr.includes(p))) {
      throw new AuthError("Claude auth expired — run /login to restore");
    }
  }

  let result = rawOutput;
  let usage: ClaudeUsage | undefined;

  if (streaming) {
    for (const line of rawOutput.split("\n")) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as StreamEvent;
        if (ev.type === "result" && ev.result !== undefined) {
          result = ev.result;
        }
        if (ev.usage) {
          usage = {
            input_tokens: ev.usage.input_tokens ?? 0,
            output_tokens: ev.usage.output_tokens ?? 0,
            cache_read_input_tokens: ev.usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: ev.usage.cache_creation_input_tokens ?? 0,
          };
        }
      } catch {}
    }
  } else {
    try {
      const envelope = JSON.parse(result);
      if (envelope?.usage) {
        usage = {
          input_tokens: envelope.usage.input_tokens ?? 0,
          output_tokens: envelope.usage.output_tokens ?? 0,
          cache_read_input_tokens: envelope.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: envelope.usage.cache_creation_input_tokens ?? 0,
        };
      }
    } catch { /* non-JSON output or missing usage — ok */ }
  }

  return { exitCode, result, usage };
}
