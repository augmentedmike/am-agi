# am

Amelia's monorepo — tooling, docs, and workspaces.

## Structure

```
am/
├── bin/          # CLI scripts (add to PATH)
├── docs/         # Reference documentation
│   ├── AGENT-LOOP.MD       # Wiggum loop
│   ├── KANBAN.MD           # Agent state machine
│   ├── CLI.MD              # Agent CLI contract
│   └── coding-standards/   # TypeScript style guide + examples
└── workspaces/   # Project workspaces (gitignored)
```

## Setup

Add `bin/` to your PATH:

```sh
export PATH="$HOME/am/bin:$PATH"
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
| [CLI.MD](docs/CLI.MD) | CLI contract for agents — `board` command for creating, moving, archiving, and searching cards backed by QMD |

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
