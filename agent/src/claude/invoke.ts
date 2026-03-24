import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { exec as defaultExec, type ExecFn } from "../exec.ts";

export interface InvokeResult {
  success: boolean;
  log: string;
  outputPath: string;
}

export interface InvokeClaudeOptions {
  claudePath?: string;
  cwd?: string;
  execFn?: ExecFn;
}

/**
 * Extract the agent log text from Claude's JSON output.
 * `--output-format json` emits `{ result: string, ... }`.
 * Falls back to raw text if parsing fails.
 */
export function extractLog(jsonText: string): string {
  try {
    const parsed = JSON.parse(jsonText) as { result?: string };
    return parsed.result ?? jsonText;
  } catch {
    return jsonText;
  }
}

/**
 * Invoke Claude Code for one iteration.
 *
 * Runs:
 *   claude --dangerously-skip-permissions -p <prompt> --output-format json
 *
 * Writes:
 *   <iterDir>/output.json  — raw JSON stdout from claude
 *   <iterDir>/agent.log    — extracted log text (or stderr on failure)
 *
 * Returns success=false (without throwing) on non-zero exit.
 */
export async function invokeClaudeCode(
  prompt: string,
  iterDir: string,
  opts: InvokeClaudeOptions = {},
): Promise<InvokeResult> {
  const claudePath = opts.claudePath ?? "claude";
  const execFn = opts.execFn ?? defaultExec;
  const outputPath = join(iterDir, "output.json");

  await mkdir(iterDir, { recursive: true });

  // Pass prompt via env var to avoid shell-injection in the -p argument.
  const result = await execFn(
    `${claudePath} --dangerously-skip-permissions -p "$CLAUDE_PROMPT" --output-format json`,
    {
      cwd: opts.cwd,
      env: { ...process.env, CLAUDE_PROMPT: prompt },
    },
  );

  await Bun.write(outputPath, result.stdout);

  if (result.exitCode !== 0) {
    const log = result.stderr.trim() || `claude exited with code ${result.exitCode}`;
    await Bun.write(join(iterDir, "agent.log"), log);
    return { success: false, log, outputPath };
  }

  const log = extractLog(result.stdout);
  await Bun.write(join(iterDir, "agent.log"), log);
  return { success: true, log, outputPath };
}
