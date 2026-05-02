import { readFile, access, writeFile, appendFile, mkdir } from "node:fs/promises";
import { existsSync, statSync, mkdtempSync, writeFileSync, rmSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveAdapter, type AdapterInvokeOptions } from "../loop/adapter";
import { loadContext } from "../loop/load-context";
import { buildPrompt } from "../loop/build-prompt";
import { buildSystemPrompt } from "../loop/system-prompt";
import { buildMcpConfig, advanceCursor } from "../search/providers";
import type { FileSystem } from "../loop/filesystem";
import type { ClaudeResult, ClaudeUsage } from "../loop/types";

const CONTEXT_LIMIT_TOKENS = 200_000;
const CONTEXT_WARN_PCT = 40;

/** Node.js-compatible FileSystem implementation — no Bun APIs. */
class NodeFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    return readFile(path, "utf8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, "utf8");
  }

  async appendFile(path: string, content: string): Promise<void> {
    await appendFile(path, content, "utf8");
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }
}

function appendUsageToIterLog(workDir: string, usage: ClaudeUsage): void {
  const iterDir = join(workDir, "iter");
  if (!existsSync(iterDir)) return;

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

/**
 * Node.js-compatible `runIteration` — identical in behavior to the Bun version
 * in `agent/src/loop/index.ts` but uses only Node.js APIs (no Bun.spawn, no
 * Bun.file, no Bun.which). Suitable for use in Next.js API routes.
 */
export async function runIteration(
  workDir: string,
  options: AdapterInvokeOptions = {},
): Promise<ClaudeResult> {
  // Safety: a git worktree has .git as a FILE; the main repo has .git as a DIRECTORY.
  // Refuse to run if workDir is the main repo root — task artifacts must stay in worktrees.
  const gitEntry = join(workDir, ".git");
  if (existsSync(gitEntry) && statSync(gitEntry).isDirectory()) {
    throw new Error(`runIteration: workDir "${workDir}" is a main repo root, not a worktree — refusing to run`);
  }

  // 1. READ (using Node.js FileSystem — no Bun.file)
  const fs = new NodeFileSystem();
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
    tempMcpDir = mkdtempSync(join(tmpdir(), "am-mcp-"));
    mcpConfigPath = join(tempMcpDir, "mcp.json");
    writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf8");

    if (providerCount >= 2) {
      const stateDir = join(workDir, ".am");
      preferredSearchProvider = advanceCursor(stateDir);
    }
  }

  // 3. INVOKE (using Node.js-compatible invokeClaude)
  const prompt = buildPrompt(ctx);
  const repoRoot = workDir;
  const systemPrompt = options.systemPrompt ?? buildSystemPrompt(repoRoot, preferredSearchProvider);
  const adapter = resolveAdapter(process.env);
  const adapterResult = await adapter.invoke(workDir, prompt, { ...options, systemPrompt, mcpConfigPath });

  // Cleanup temp mcp dir
  if (tempMcpDir) {
    try { rmSync(tempMcpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }

  // 4. LOG context usage + EXIT
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

  if (result.usage) {
    appendUsageToIterLog(workDir, result.usage);
  }

  return result;
}
