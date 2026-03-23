import { BunFileSystem } from "./filesystem";
import { loadContext } from "./load-context";
import { buildPrompt } from "./build-prompt";
import { invokeClaude, type InvokeOptions } from "./invoke-claude";
import type { ClaudeResult } from "./types";

export type { WorkContext } from "./types";
export type { ClaudeResult } from "./types";
export type { FileSystem } from "./filesystem";
export { BunFileSystem } from "./filesystem";
export { loadContext } from "./load-context";
export { buildPrompt } from "./build-prompt";
export { invokeClaude } from "./invoke-claude";

/**
 * Run one iteration of the Wiggum agent loop.
 *
 * Steps:
 *   1. READ   — load work.md (required), criteria.md and todo.md if present
 *   2. INVOKE — run `claude --dangerously-skip-permissions -p <prompt> --output-format json`
 *               with cwd set to workDir
 *   3. EXIT   — return the result
 *
 * @param workDir  Absolute path to the git worktree for this task.
 * @param options  Optional overrides (e.g. claudePath for testing).
 */
export async function runIteration(
  workDir: string,
  options: InvokeOptions = {},
): Promise<ClaudeResult> {
  // 1. READ
  const fs = new BunFileSystem();
  const ctx = await loadContext(workDir, fs);

  // 2. INVOKE
  const prompt = buildPrompt(ctx);
  const result = await invokeClaude(workDir, prompt, options);

  // 3. EXIT
  return result;
}
