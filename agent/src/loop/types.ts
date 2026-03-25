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

/** Token usage reported by the Claude CLI (--output-format json). */
export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

/** Result of invoking Claude CLI for one iteration. */
export interface ClaudeResult {
  /** Exit code from the claude process. */
  exitCode: number;
  /** Text output from the claude process (stdout). */
  result: string;
  /** Token usage from the CLI JSON envelope — undefined if parsing fails. */
  usage?: ClaudeUsage;
}
