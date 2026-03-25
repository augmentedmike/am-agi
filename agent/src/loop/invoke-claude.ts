import type { ClaudeResult } from "./types";

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

  // Strip Claude Code session markers so the subprocess is not treated as a
  // nested invocation (CLAUDECODE=1 causes auth to fail in sub-processes).
  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, ...spawnEnv } = process.env;

  // Explicitly point at the user's ~/.claude so all concurrent subprocesses
  // share the same auth dir and token refreshes don't race against each other.
  if (!spawnEnv.CLAUDE_CONFIG_DIR && spawnEnv.HOME) {
    spawnEnv.CLAUDE_CONFIG_DIR = `${spawnEnv.HOME}/.claude`;
  }

  const args = [claudePath, "--dangerously-skip-permissions", "-p", prompt, "--output-format", "json"];
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
