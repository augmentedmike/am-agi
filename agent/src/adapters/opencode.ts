import { spawn as _spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import type { ClaudeResult, ClaudeUsage } from "../loop/types";

type SpawnFn = (cmd: string, args: string[], opts: SpawnOptions) => ChildProcess;

/** Thrown when the opencode process reports an authentication failure. */
export class OpencodeAuthError extends Error {
  constructor(message = "Opencode auth expired") {
    super(message);
    this.name = "OpencodeAuthError";
  }
}

export interface OpencodeStreamEvent {
  type: string;
  timestamp?: number;
  sessionID?: string;
  part?: Record<string, unknown>;
  error?: Record<string, unknown>;
  text?: string;
}

export interface InvokeOptions {
  /** Path to the opencode executable. Defaults to "opencode". */
  opencodePath?: string;
  /** Optional model override (e.g. "anthropic/claude-sonnet-4-20250514"). */
  model?: string;
  /**
   * Called for each parsed stream-json event as they arrive.
   */
  onEvent?: (event: OpencodeStreamEvent) => void;
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
 * INVOKE OPENCODE step — run the opencode CLI with the given prompt,
 * streaming stdout/stderr through to the parent process.
 *
 * Node.js-compatible version: uses `child_process.spawn` instead of
 * `Bun.spawn`/`Bun.which`. Suitable for use in Next.js API routes.
 *
 * Uses `--format json`. Output is NDJSON with event types:
 *   - step_start, text, tool_use, error, step_finish
 *
 * Throws `OpencodeAuthError` if auth patterns are detected.
 */
export async function invokeOpencode(
  workDir: string,
  prompt: string,
  options: InvokeOptions = {},
): Promise<ClaudeResult> {
  const opencodePath = options.opencodePath ?? "opencode";
  const streaming = !!options.onEvent;

  // Strip opencode env vars so the subprocess uses its own config
  const { OPENCODE_CONFIG, OPENCODE_CONFIG_DIR, ...spawnEnv } = process.env;

  // Resolve the full path using PATH lookup (no Bun.which)
  const resolvedOpencode = resolveExecutable(opencodePath, spawnEnv.PATH);

  const args = ["run", prompt, "--format", "json"];
  if (options.model) args.push("--model", options.model);

  const spawnImpl = options.spawnFn ?? _spawn;
  const proc = spawnImpl(resolvedOpencode, args, {
    cwd: workDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: spawnEnv as NodeJS.ProcessEnv,
  });

  const decoder = new TextDecoder();
  let lineBuffer = "";

  // Set up close listener BEFORE awaiting stdout/stderr
  const exitCodePromise = new Promise<number>((resolve, reject) => {
    proc.on("close", resolve);
    proc.on("error", reject);
  });

  let resultText = "";
  let usage: ClaudeUsage | undefined;

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
            try {
              const event = JSON.parse(line) as OpencodeStreamEvent;
              options.onEvent!(event);

              // Collect text from text events
              if (event.type === "text" && event.part?.text) {
                resultText += event.part.text as string;
              }

              // Extract usage from step_finish events
              if (event.type === "step_finish" && event.part?.tokens) {
                const tokens = event.part.tokens as Record<string, unknown>;
                const cache = (tokens.cache ?? {}) as Record<string, unknown>;
                usage = {
                  input_tokens: (tokens.input as number) ?? 0,
                  output_tokens: (tokens.output as number) ?? 0,
                  cache_read_input_tokens: (cache.read as number) ?? 0,
                  cache_creation_input_tokens: (cache.write as number) ?? 0,
                };
              }
            } catch { /* skip malformed */ }
          }
        }
      });
      proc.stdout!.on("end", () => {
        // Flush remaining buffer
        if (streaming && options.onEvent && lineBuffer.trim()) {
          try {
            const event = JSON.parse(lineBuffer) as OpencodeStreamEvent;
            options.onEvent!(event);
            if (event.type === "text" && event.part?.text) {
              resultText += event.part.text as string;
            }
            if (event.type === "step_finish" && event.part?.tokens) {
              const tokens = event.part.tokens as Record<string, unknown>;
              const cache = (tokens.cache ?? {}) as Record<string, unknown>;
              usage = {
                input_tokens: (tokens.input as number) ?? 0,
                output_tokens: (tokens.output as number) ?? 0,
                cache_read_input_tokens: (cache.read as number) ?? 0,
                cache_creation_input_tokens: (cache.write as number) ?? 0,
              };
            }
          } catch {}
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

  // Auth failure detection
  if (exitCode !== 0) {
    const combined = rawOutput + stderrText;
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
    const lowerCombined = combined.toLowerCase();
    if (authPatterns.some((p) => lowerCombined.includes(p))) {
      throw new OpencodeAuthError(combined.trim().slice(0, 500));
    }
  }

  // If not streaming, parse result from collected chunks
  if (!streaming) {
    // Re-parse stdout for text and step_finish events
    for (const line of rawOutput.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as OpencodeStreamEvent;
        if (event.type === "text" && event.part?.text) {
          resultText += event.part.text as string;
        }
        if (event.type === "step_finish" && event.part?.tokens) {
          const tokens = event.part.tokens as Record<string, unknown>;
          const cache = (tokens.cache ?? {}) as Record<string, unknown>;
          usage = {
            input_tokens: (tokens.input as number) ?? 0,
            output_tokens: (tokens.output as number) ?? 0,
            cache_read_input_tokens: (cache.read as number) ?? 0,
            cache_creation_input_tokens: (cache.write as number) ?? 0,
          };
        }
      } catch {}
    }
  }

  return { exitCode, result: resultText, usage };
}
