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

export interface InvokeOptions {
  /** Path to the claude executable. Defaults to "claude". */
  claudePath?: string;
  /** Optional system prompt passed via --system-prompt to the Claude CLI. */
  systemPrompt?: string;
}

/**
 * INVOKE CLAUDE step — run the Claude CLI with the given prompt, streaming
 * stdout/stderr through to the parent process.
 *
 * Uses `--dangerously-skip-permissions` and `--output-format json`.
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

  const args = [resolvedClaude, "--dangerously-skip-permissions", "-p", prompt, "--output-format", "json"];
  if (options.systemPrompt) args.splice(1, 0, "--system-prompt", options.systemPrompt);

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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        process.stdout.write(value);
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
  const result = stdoutChunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
  const stderrText = stderrChunks.map((c) => new TextDecoder().decode(c)).join("");

  // Re-emit stderr to parent process so the human can see it.
  if (stderrText) {
    process.stderr.write(stderrText);
  }

  // Detect auth failure — throw so callers can handle it without retrying.
  if (stderrText.includes("Not logged in")) {
    throw new AuthError("Claude auth expired — run /login to restore");
  }

  // Parse usage from the CLI JSON envelope (--output-format json)
  let usage: ClaudeUsage | undefined;
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

  return { exitCode, result, usage };
}
