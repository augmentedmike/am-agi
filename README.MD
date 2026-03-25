# am

Amelia's monorepo — tooling, docs, and workspaces.

We are building the best functionality from our [MiniClaw](https://github.com/augmentedmike/miniclaw-os) project in public, to show aspiring AI engineers how harness building and autonomous agents are built, using an agentic workflow.

Unless otherwise specified, Claude Anthropic models are used because they are simply the best agentic models on the market.

## Structure

```
am/
├── agent/        # Agent runtime (loop, runner, Claude invoker, git helpers)
├── apps/
│   └── board/    # Kanban board — Next.js, SQLite, REST API, gate worker
├── scripts/      # Source for CLI tools (board, dispatcher, new-next)
├── bin/          # CLI scripts (add to PATH via init.sh — gitignored)
├── docs/         # Reference documentation
│   ├── AGENT-LOOP.MD       # Wiggum loop
│   ├── KANBAN.MD           # Agent state machine
│   ├── CLI.MD              # Agent CLI contract
│   ├── ARCHITECTURE.md     # Full system map
│   └── coding-standards/   # TypeScript style guide + examples
└── steps/        # Step-by-step build guide (1–10)
```

## Getting Started

If you're following along with the YouTube videos, start from the tagged release that matches where the series begins:

**[0.0.1-initial-structure](https://github.com/augmentedmike/am-agi/releases/tag/0.0.1-initial-structure)** — initial project structure
**[0.0.2-step-1-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.2-step-1-completed)** — session bootstrap
**[0.0.3-step-2-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.3-step-2-completed)** — agent loop (one-shot Claude invocation)
**[0.0.4-step-3-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.4-step-3-completed)** — runner (iteration loop + git commits)
**[0.0.5-step-4-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.5-step-4-completed)** — Claude invoker with JSON output + git squash helpers
**[0.0.6-step-5-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.6-step-5-completed)** — Kanban board (Next.js + SQLite + REST API)
**[0.0.7-step-6-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.7-step-6-completed)** — board CLI + gate worker
**[0.0.8-step-7-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.8-step-7-completed)** — zinc/glass UI, collapsible Shipped column, archive
**[0.0.9-step-8-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.9-step-8-completed)** — richer gate checks, column prompts
**[0.0.10-step-9-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.10-step-9-completed)** — glass card tiles, slide panel, active agent indicator
**[0.0.11-step-10-completed](https://github.com/augmentedmike/am-agi/releases/tag/0.0.11-step-10-completed)** — dispatcher, board polling, new card panel

```sh
git clone https://github.com/augmentedmike/am-agi.git
git checkout 0.0.1-initial-structure   # or any tag above
```

## Setup

```sh
source ./init.sh
```

## Running

```sh
# Board UI (must use npm — better-sqlite3 requires Node)
cd apps/board && npm run dev   # http://localhost:3000

# Dispatcher — polls the board and runs agent iterations
dispatcher
```

## bin/board

The agent's interface to the Kanban board. All card state changes go through this command — no direct DB access.

```sh
board create --title <title> [--priority critical|high|normal|low]
board move <id> <state>
board update <id> [--title <t>] [--priority <p>] [--log <msg>] [--attach <path>...] [--workdir <path>]
board show <id>
board search [--state <s>] [--priority <p>] [--text <q>] [--all]
board archive <id> [--reason <msg>]
```

## bin/dispatcher

Polls the board API every 5 seconds. For each active column, picks the highest-priority card, ensures a git worktree exists, writes `work.md`, and runs one agent iteration.

```sh
dispatcher                        # uses BOARD_URL (default: http://localhost:3000)
BOARD_URL=http://localhost:3001 dispatcher
```

## bin/new-next

Scaffolds a new Next.js project with the standard stack.

**Stack:** TypeScript · ESLint · Tailwind 4 · src/ · App Router · Bun · Turbopack · Vercel (local dev)

```sh
new-next <project-name>
```

This runs `create-next-app` with all defaults pre-set, installs `vercel` as a dev dependency, and swaps the `dev` script to `vercel dev` for local deploys.

## docs

| File | Summary |
|---|---|
| [AGENT-LOOP.MD](docs/AGENT-LOOP.MD) | The agent loop — one-shot agentic iteration pattern with pre/post git hooks, worktree isolation, and a linear merge strategy |
| [KANBAN.MD](docs/KANBAN.MD) | The agent's brain — state machine with gated transitions, priorities, work log, and attachments |
| [CLI.MD](docs/CLI.MD) | CLI contract for agents — `board` command for creating, moving, archiving, and searching cards |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system map — every component, how they connect, how a card goes from idea to shipped |

## docs/coding-standards

TypeScript style guide at `docs/coding-standards/ts-style.md`, with per-topic examples in `docs/coding-standards/examples/ts/`:

| File | Topic |
|------|-------|
| `variables.md` | Variable naming and declaration |
| `functions.md` | Function design |
| `objects.md` | Objects and data structures |
| `classes.md` | Class patterns |
| `solid.md` | SOLID principles |
| `testing.md` | Testing overview |
| `unit-testing.md` | Unit test patterns |
| `concurrency.md` | Async / concurrency |
| `error-handling.md` | Error handling |
| `formatting.md` | Formatting |
| `comments.md` | Comments |
| `complexity.md` | Complexity management |
| `file-naming.md` | File naming conventions |
| `folder-structure.md` | Folder structure |
| `linting.md` | Linting config |
| `immutability.md` | Immutability patterns |
| `dsls.md` | DSL / metaprogramming |
| `metaprogramming.md` | Metaprogramming |
| `bun-runtime.md` | Bun-specific runtime |
