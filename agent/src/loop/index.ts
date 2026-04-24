import { BunFileSystem } from "./filesystem";
import { loadContext, loadDomainContext } from "./load-context";
import { buildPrompt } from "./build-prompt";
import { invokeClaude, type InvokeOptions } from "./invoke-claude";
import { buildSystemPrompt } from "./system-prompt";
import { buildMcpConfig, advanceCursor } from "../search/providers";
import type { ProjectAdapter } from "./project-adapter";
import { join } from "node:path";
import { readdirSync, appendFileSync, existsSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { ClaudeResult, ClaudeUsage } from "./types";
import type { AgentAdapter } from "./adapter";
import { resolveAdapter, queryAdapter } from "./adapter";

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
export type { AgentAdapter, AdapterInvokeOptions, AdapterResult, AdapterUsage, StreamChunk, AdapterCapabilities } from "./adapter";
export { resolveAdapter, queryAdapter } from "./adapter";
export { ProviderAuthError, ProviderRateLimitError, ProviderTimeoutError } from "./errors";
export { BunFileSystem } from "./filesystem";
export { loadContext, loadDomainContext } from "./load-context";
export { buildPrompt } from "./build-prompt";
export { invokeClaude, RateLimitError, parseRateLimitReset } from "./invoke-claude";
export { ClaudeCodeAdapter } from "./adapters/claude-code";
export type { StorageLayer } from "./storage";

/**
 * Run one iteration of the Wiggum agent loop.
 *
 * Steps:
 *   1. READ        — load work.md (required), criteria.md and todo.md if present
 *   2. DOMAIN CTX  — if adapter has a storageLayer, load domain context
 *   3. INVOKE      — call adapter.invoke() (defaults to ClaudeAdapter → Claude CLI subprocess)
 *   4. EXIT        — return the result
 *
 * @param workDir  Absolute path to the git worktree for this task.
 * @param options  Optional overrides (e.g. agentAdapter for testing).
 * @param adapter  Optional model adapter. Defaults to the adapter resolved from
 *                 environment variables via `resolveAdapter()`.
 */
export type { ProjectAdapter } from "./project-adapter";
export { ResearchProjectAdapter } from "./project-adapter";
export { PortfolioContentAdapter } from "./portfolio-content-adapter";
export type { PortfolioDomainContext, PostEntry } from "./portfolio-content-adapter";

export async function runIteration(
  workDir: string,
  options: Omit<InvokeOptions, "claudePath"> & { adapter?: ProjectAdapter; agentAdapter?: AgentAdapter } = {},
): Promise<ClaudeResult> {
  if (!existsSync(workDir)) {
    throw new Error(`workDir does not exist: ${workDir}`);
  }

  // Safety: a git worktree has .git as a FILE; the main repo has .git as a DIRECTORY.
  // Refuse to run if workDir is the main repo root — task artifacts must stay in worktrees.
  const gitEntry = join(workDir, ".git");
  if (existsSync(gitEntry) && statSync(gitEntry).isDirectory()) {
    throw new Error(`runIteration: workDir "${workDir}" is a main repo root, not a worktree — refusing to run`);
  }

  // 1. READ
  const fs = new BunFileSystem();
  const ctx = await loadContext(workDir, fs);

  // 2. BUILD MCP config + preferred provider
  const mcpConfig = buildMcpConfig(process.env);
  const providerCount = mcpConfig
    ? Object.keys((mcpConfig.mcpServers as Record<string, unknown>)).length
    : 0;

  let mcpConfigPath: string | undefined;
  let tempMcpDir: string | undefined;
  let preferredSearchProvider: string | undefined;

  if (mcpConfig) {
    // Write temp mcp.json
    tempMcpDir = mkdtempSync(join(tmpdir(), "am-mcp-"));
    mcpConfigPath = join(tempMcpDir, "mcp.json");
    writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf8");

    // Round-robin only makes sense with 2+ providers
    if (providerCount >= 2) {
      const stateDir = join(workDir, ".am");
      preferredSearchProvider = advanceCursor(stateDir);
    }
  }

  // 3. DOMAIN CTX — load adapter-specific domain context if available
  const { adapter, agentAdapter, ...invokeOptions } = options;

  // Lifecycle: init() before any prompt building
  if (adapter?.init) {
    await adapter.init(workDir);
  }

  let domainCtx: unknown = undefined;
  if (adapter?.storageLayer) {
    domainCtx = await loadDomainContext(
      adapter as Parameters<typeof loadDomainContext>[0],
      workDir,
      fs,
    );
  }

  // 4. INVOKE — wrap in try/finally so close() always runs
  const repoRoot = workDir;
  const prompt = adapter ? adapter.buildPrompt(ctx, domainCtx) : buildPrompt(ctx);
  const systemPrompt = invokeOptions.systemPrompt ?? (
    adapter
      ? adapter.buildSystemPrompt(repoRoot, preferredSearchProvider)
      : buildSystemPrompt(repoRoot, preferredSearchProvider)
  );

  const resolvedAdapter = agentAdapter ?? queryAdapter(workDir, process.env);
  let adapterResult: Awaited<ReturnType<typeof resolvedAdapter.invoke>>;
  try {
    adapterResult = await resolvedAdapter.invoke(workDir, prompt, {
      systemPrompt,
      mcpConfigPath,
      onEvent: invokeOptions.onEvent,
    });
  } finally {
    if (adapter?.close) {
      adapter.close();
    }
  }

  // Normalise AdapterResult → ClaudeResult so callers see no change.
  const result: ClaudeResult = {
    exitCode: adapterResult.exitCode,
    result: adapterResult.result,
    usage: adapterResult.usage
      ? {
          input_tokens: adapterResult.usage.inputTokens,
          output_tokens: adapterResult.usage.outputTokens,
          cache_read_input_tokens: adapterResult.usage.cacheReadTokens,
          cache_creation_input_tokens: adapterResult.usage.cacheWriteTokens,
        }
      : undefined,
  };

  // Cleanup temp mcp dir
  if (tempMcpDir) {
    try { rmSync(tempMcpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }

  // 4. LOG context usage + EXIT
  if (result.usage) {
    appendUsageToIterLog(workDir, result.usage);
  }
  return result;
}
