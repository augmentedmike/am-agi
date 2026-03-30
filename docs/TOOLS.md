# Tools

## Board CLI

Your interface to the Kanban board. All process actions go through this.

```sh
board create --title <title> [--priority critical|high|normal|low] [--attach <path>...]
board move <id> <state>
board update <id> [--title <t>] [--priority <p>] [--log <msg>] [--attach <path>...] [--workdir <path>]
board show <id>
board search [--state <state>] [--priority <priority>] [--text <query>] [--all]
board archive <id> [--reason <msg>]
```

States: `backlog` → `in-progress` → `in-review` → `shipped`

`board move` is gate-enforced. If rejected, the specific failures are printed — address them and retry.

## Git

```sh
git add -A
git commit -m "<message>"
git status
git diff
git log --oneline
```

Commit after every meaningful unit of work.

## Bun

```sh
bun test              # run all tests
bun test <file>       # run specific test file
bun run dev           # start dev server (board app)
bun install           # install dependencies
```

## File System

Read, write, and edit files directly. All work happens inside your worktree.

## Web Search

AM supports multiple search providers via MCP. Configure one or more by setting the appropriate environment variable — the agent loop will automatically build an `mcp.json` and inject it into each Claude invocation.

| Provider | Env var | Free tier | MCP server key |
|---|---|---|---|
| **Tavily** | `TAVILY_API_KEY` | 1,000 searches/month (dev key) | `tavily-search` |
| **Exa** | `EXA_API_KEY` | 1,000 searches/month | `exa-search` |
| **You.com** | `YOU_API_KEY` (paid) or `YOU_FREE_SEARCH=1` | Unlimited free web search | `you-search` |
| **Firecrawl** | `FIRECRAWL_API_KEY` | 500 credits/month (free tier) | `firecrawl-search` |

**Round-robin behavior:** When two or more providers are configured the agent loop rotates through them in order (Tavily → Exa → You.com → Firecrawl → Tavily …) using a cursor stored in `<workDir>/.am/search-cursor`. This spreads API usage across quotas over time.

**Single provider:** When only one provider is configured, that provider is always used — no cursor needed.

**No provider:** When no env vars are set, no `mcp.json` is written and the agent runs without web search.

### Setup

```sh
# Store keys in vault
vault set TAVILY_API_KEY
vault set EXA_API_KEY
vault set FIRECRAWL_API_KEY

# Or enable You.com free search (no key required)
export YOU_FREE_SEARCH=1
```

### Using search in agent prompts

When a `preferredSearchProvider` is active, the system prompt includes a hint:
> "When performing web searches, prefer the `<tool-name>` tool."

The agent will use the preferred tool first and fall back to others as needed.

## Bug Reporting

When you hit a bug or unexpected behavior, use the right channel:

| Type | Where | Command |
|---|---|---|
| AM tooling bug (board CLI, agent loop, gate failures) | Board card | `board create --title "Bug: <description>" --priority high` |
| AM system bug affecting all users | GitHub Issues | https://github.com/augmentedmike/am-agi/issues |

**What to include in the report:**
- Steps to reproduce
- Expected vs actual behavior
- Relevant log output from `iter/<n>/agent.log`
- Board card ID if the failure happened during a task
