import type { ClaudeResult } from "./types";

export interface InvokeOptions {
  /** Path to the claude executable. Defaults to "claude". */
  claudePath?: string;
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

  const proc = Bun.spawn(
    [claudePath, "--dangerously-skip-permissions", "-p", prompt, "--output-format", "json"],
    {
      cwd: workDir,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "ignore",
    },
  );

  const exitCode = await proc.exited;
  return { exitCode };
}
