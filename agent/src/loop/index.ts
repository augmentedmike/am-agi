import { BunFileSystem } from "./filesystem";
import { loadContext } from "./load-context";
import { buildPrompt } from "./build-prompt";
import { invokeClaude, type InvokeOptions } from "./invoke-claude";
import { buildSystemPrompt } from "./system-prompt";
import { join } from "node:path";
import { readdirSync, appendFileSync, existsSync } from "node:fs";
import type { ClaudeResult, ClaudeUsage } from "./types";

const CONTEXT_LIMIT_TOKENS = 200_000; // Sonnet 4.6
const CONTEXT_WARN_PCT = 40;

function appendUsageToIterLog(workDir: string, usage: ClaudeUsage): void {
  const iterDir = join(workDir, "iter");
  if (!existsSync(iterDir)) return;

  // Find the highest-numbered iter directory
  const latest = readdirSync(iterDir)
    .map(d => parseInt(d, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => b - a)[0];

  if (latest === undefined) return;

  const logPath = join(iterDir, String(latest), "agent.log");
  if (!existsSync(logPath)) return;

  const total = usage.input_tokens + usage.output_tokens;
  const pct = (total / CONTEXT_LIMIT_TOKENS) * 100;
  const triggered = pct >= CONTEXT_WARN_PCT;

  const lines = [
    "",
    "## context-usage",
    `input_tokens:  ${usage.input_tokens.toLocaleString()}`,
    `output_tokens: ${usage.output_tokens.toLocaleString()}`,
    `cache_read:    ${usage.cache_read_input_tokens.toLocaleString()}`,
    `total:         ${total.toLocaleString()} / ${CONTEXT_LIMIT_TOKENS.toLocaleString()} (${pct.toFixed(1)}%)`,
    triggered ? `⚠️  context limit triggered — ${pct.toFixed(1)}% ≥ ${CONTEXT_WARN_PCT}%` : `✓ within budget`,
  ];

  appendFileSync(logPath, lines.join("\n") + "\n");
}

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
  const repoRoot = workDir;
  const systemPrompt = options.systemPrompt ?? buildSystemPrompt(repoRoot);
  const result = await invokeClaude(workDir, prompt, { ...options, systemPrompt });

  // 3. LOG context usage + EXIT
  if (result.usage) {
    appendUsageToIterLog(workDir, result.usage);
  }
  return result;
}
