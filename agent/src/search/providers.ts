import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Provider definitions
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  /** Short unique name used for indexing (e.g. "tavily"). */
  name: string;
  /** MCP server entry key used in the config object. */
  serverName: string;
  /** SSE endpoint URL. */
  url: string;
  /** Optional HTTP headers (e.g. Authorization). */
  headers?: Record<string, string>;
}

/**
 * Return the list of providers that have credentials in `env`.
 * Order is stable: Tavily → Exa → You.com → Firecrawl.
 */
function getConfiguredProviders(env: NodeJS.ProcessEnv): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (env.TAVILY_API_KEY) {
    providers.push({
      name: "tavily",
      serverName: "tavily-search",
      url: `https://mcp.tavily.com/mcp/?tavilyApiKey=${env.TAVILY_API_KEY}`,
    });
  }

  if (env.EXA_API_KEY) {
    providers.push({
      name: "exa",
      serverName: "exa-search",
      url: "https://mcp.exa.ai/sse",
      headers: { Authorization: `Bearer ${env.EXA_API_KEY}` },
    });
  }

  if (env.YOU_API_KEY) {
    providers.push({
      name: "you",
      serverName: "you-search",
      url: "https://mcp.you.com/sse",
      headers: { Authorization: `Bearer ${env.YOU_API_KEY}` },
    });
  } else if (env.YOU_FREE_SEARCH === "1") {
    providers.push({
      name: "you",
      serverName: "you-search",
      url: "https://mcp.you.com/sse",
    });
  }

  if (env.FIRECRAWL_API_KEY) {
    providers.push({
      name: "firecrawl",
      serverName: "firecrawl-search",
      url: `https://mcp.firecrawl.dev/${env.FIRECRAWL_API_KEY}/v2/mcp`,
    });
  }

  return providers;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Claude MCP config object for all configured search providers.
 *
 * Returns `null` when no provider credentials are present in `env` — the
 * caller should skip writing any `mcp.json` file.
 *
 * @param env  Environment variable map (typically `process.env`).
 */
export function buildMcpConfig(
  env: NodeJS.ProcessEnv,
): Record<string, unknown> | null {
  const providers = getConfiguredProviders(env);
  if (providers.length === 0) return null;

  const mcpServers: Record<string, unknown> = {};
  for (const p of providers) {
    const entry: Record<string, unknown> = { type: "sse", url: p.url };
    if (p.headers) entry.headers = p.headers;
    mcpServers[p.serverName] = entry;
  }

  return { mcpServers };
}

/**
 * Round-robin cursor — reads an integer from `<stateDir>/search-cursor`,
 * returns the preferred provider's `serverName`, and writes `cursor + 1`
 * back atomically.
 *
 * Intended for use when two or more providers are configured so that search
 * load is distributed across API quotas over time.
 *
 * @param stateDir  Directory that holds the `search-cursor` file (created if absent).
 * @returns         The `serverName` of the preferred provider for this call.
 * @throws          When no providers are configured in `process.env`.
 */
export function advanceCursor(stateDir: string): string {
  const providers = getConfiguredProviders(process.env);
  if (providers.length === 0) {
    throw new Error("advanceCursor: no search providers configured");
  }

  const cursorPath = join(stateDir, "search-cursor");

  // Read current cursor (default 0 if file absent or malformed)
  let cursor = 0;
  if (existsSync(cursorPath)) {
    const raw = readFileSync(cursorPath, "utf8").trim();
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) cursor = parsed;
  }

  const preferred = providers[cursor % providers.length];

  // Write cursor + 1 back (atomic enough for a single-process loop)
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(cursorPath, String(cursor + 1), "utf8");

  return preferred.serverName;
}
