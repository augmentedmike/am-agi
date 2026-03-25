import type { ClaudeResult } from "./types";

// Serialize claude process startup to prevent concurrent OAuth token refresh
// races. All invocations share this lock. Each caller holds it for
// STARTUP_HOLD_MS after spawning, giving the process time to auth before the
// next one starts. Processes then run fully concurrently after that.
let startupLock: Promise<void> = Promise.resolve();
const STARTUP_HOLD_MS = 4_000;

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
      stderr: "inherit",
      stdin: "ignore",
      env: spawnEnv,
    },
  );

  // Hold the lock for STARTUP_HOLD_MS then release so the next spawn can start
  setTimeout(releaseLock, STARTUP_HOLD_MS);

  // Collect stdout while also streaming it to the parent process
  const chunks: Uint8Array[] = [];
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    process.stdout.write(value);
  }

  const exitCode = await proc.exited;
  const result = chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();

  return { exitCode, result };
}
