# Web Search

AM agents can search the web during research tasks. Four providers are supported. Configure one or more by setting the appropriate environment variable.

---

## Providers

| Provider | Env var | Free tier | Notes |
|----------|---------|-----------|-------|
| **Tavily** | `TAVILY_API_KEY` | 1,000 searches/month | Best for factual queries |
| **Exa** | `EXA_API_KEY` | 1,000 searches/month | Good for semantic search |
| **You.com** | `YOU_API_KEY` or `YOU_FREE_SEARCH=1` | Unlimited (free tier) | No key needed for free web search |
| **Firecrawl** | `FIRECRAWL_API_KEY` | 500 credits/month | Includes page scraping |

---

## Configuration

Store API keys in the vault, then export before starting AM:

```sh
# Store once
vault set TAVILY_API_KEY tvly-abc123
vault set EXA_API_KEY exa-abc123

# Export at session start
export TAVILY_API_KEY=$(vault get TAVILY_API_KEY)
export EXA_API_KEY=$(vault get EXA_API_KEY)
```

Or use You.com free search with no key:

```sh
export YOU_FREE_SEARCH=1
```

The agent loop reads these environment variables on startup and injects them into each agent invocation via `mcp.json`. No further configuration needed.

---

## Round-robin behavior

When **two or more providers** are configured, AM rotates through them in order:

```
Tavily → Exa → You.com → Firecrawl → Tavily → …
```

The rotation cursor is stored in `.am/search-cursor` in the worktree. This spreads usage across monthly quotas over time.

When **one provider** is configured, that provider is always used.

When **no providers** are configured, `mcp.json` is not written and agents run without web search. Research tasks will still work but will rely only on their training knowledge and local files.

---

## Usage in agents

When a search provider is active, agents automatically use it for research tasks. No extra prompt engineering required — the agent loop injects a hint like:

> "When performing web searches, prefer the `tavily-search` tool."

The agent will use the preferred tool first and fall back to others as available.
