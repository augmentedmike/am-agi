/**
 * Data shapes for the Wiggum agent loop.
 */

/** Files loaded from the work directory at the start of each iteration. */
export interface WorkContext {
  /** Content of work.md — always present, describes the work. */
  workMd: string;
  /** Content of criteria.md if it exists, otherwise undefined. */
  criteriaMd: string | undefined;
  /** Content of todo.md if it exists, otherwise undefined. */
  todoMd: string | undefined;
}

/** Result of invoking Claude CLI for one iteration. */
export interface ClaudeResult {
  /** Exit code from the claude process. */
  exitCode: number;
}
