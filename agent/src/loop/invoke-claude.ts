import type { ClaudeResult, ClaudeUsage } from "./types";

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
}

/**
 * INVOKE CLAUDE step — run the Claude CLI with the given prompt, streaming
 * stdout/stderr through to the parent process.
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

  // Acquire startup lock — wait for any previous spawn to finish its auth
  // window before we start. Release after STARTUP_HOLD_MS so the next caller
  // can proceed while we continue running concurrently.
  let releaseLock!: () => void;
  const prevLock = startupLock;
  startupLock = new Promise<void>(resolve => { releaseLock = resolve; });
  await prevLock;

  // Strip Claude Code session markers so the subprocess is not treated as a
  // nested invocation (CLAUDECODE=1 causes auth to fail in sub-processes).
  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, ...spawnEnv } = process.env;

  // Bun.spawn doesn't use spawnEnv.PATH for executable lookup — resolve the
  // full path explicitly so launchd agents (which have a custom PATH) work.
  const resolvedClaude = Bun.which(claudePath, { PATH: spawnEnv.PATH ?? process.env.PATH ?? "" })
    ?? claudePath;

  const outputFormat = streaming ? "stream-json" : "json";
  const args = [resolvedClaude, "--dangerously-skip-permissions", "-p", prompt, "--output-format", outputFormat];
  if (streaming) args.push("--verbose");
  if (options.systemPrompt) args.splice(1, 0, "--system-prompt", options.systemPrompt);
  if (options.model) args.splice(1, 0, "--model", options.model);

  const proc = Bun.spawn(
    args,
    {
      cwd: workDir,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
      env: spawnEnv,
    },
  );

  // Hold the lock for STARTUP_HOLD_MS then release so the next spawn can start
  setTimeout(releaseLock, STARTUP_HOLD_MS);

  const decoder = new TextDecoder();

  // Read stdout and stderr concurrently to prevent pipe deadlock.
  const [stdoutChunks, stderrChunks] = await Promise.all([
    (async () => {
      const chunks: Uint8Array[] = [];
      const reader = proc.stdout.getReader();
      let lineBuffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        process.stdout.write(value);
        if (streaming && options.onEvent) {
          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try { options.onEvent(JSON.parse(line) as StreamEvent); } catch { /* skip malformed */ }
          }
        }
      }
      // Flush remaining buffer
      if (streaming && options.onEvent && lineBuffer.trim()) {
        try { options.onEvent(JSON.parse(lineBuffer) as StreamEvent); } catch {}
      }
      return chunks;
    })(),
    (async () => {
      const chunks: Uint8Array[] = [];
      const reader = proc.stderr.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      return chunks;
    })(),
  ]);

  const exitCode = await proc.exited;
  const rawOutput = stdoutChunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
  const stderrText = stderrChunks.map((c) => new TextDecoder().decode(c)).join("");

  // Re-emit stderr to parent process so the human can see it.
  if (stderrText) {
    process.stderr.write(stderrText);
  }

  // Detect auth failure — throw so callers can handle it without retrying.
  // Criterion 1: explicit "Not logged in" message
  if (stderrText.includes("Not logged in")) {
    throw new AuthError("Claude auth expired — run /login to restore");
  }
  // Criterion 2: mid-stream auth failures — non-zero exit with auth-related stderr
  // (no "Not logged in" but other auth signals like token expiry, OAuth errors, etc.)
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
    // Extract result text and usage from the stream-json `result` event
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
    // Parse usage from the CLI JSON envelope (--output-format json)
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
