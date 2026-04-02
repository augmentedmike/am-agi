# AGENTS.md — Coding Guidelines for AM

## Bootstrap

**Run this first, every session:**

```sh
source ./init.sh
```

This adds `$HOME/am/bin` to `PATH` and makes CLI commands executable. Nothing works before this.

## Commands

### Test

```sh
bun test                          # all tests (roots: agent/, scripts/)
bun test <pattern>                # single test file, e.g. bun test invoke-claude
bun test --test-name-pattern "x"  # single test by name
bun test dispatcher.test.ts       # specific file from repo root
```

Tests live in `agent/src/` (colocated `*.test.ts`) and `scripts/`. Bun's test runner is configured in `bunfig.toml` — test roots are `./agent` and `./scripts` only. Tests never run under `board/`, `worktrees/`, or `.claude/`. Timeout is 60s.

### Lint / Type-check

```sh
cd agent && npx tsc --noEmit        # agent TypeScript
cd board && npx tsc --noEmit        # board TypeScript (Next.js app)
```

No ESLint config. Formatting is enforced by `.editorconfig` (2-space indent, LF, trailing whitespace trimmed, final newline).

### Build / Dev

```sh
cd board && npm run dev             # Next.js dev server (port 4221, Turbopack)
cd board && npm run build           # production build
cd board && npm run start           # production server (port 4220)
```

**Use `npm` for the board app, not `bun`** — `better-sqlite3` native module cannot load under Bun.

### Board CLI

```sh
board create --title "..." --priority high
board search --state in-progress
board move <id> in-review
board show <id>
```

See `CLAUDE.md` for full CLI reference.

## Code Style

### Language

- **TypeScript everywhere.** Strict mode enabled (`strict: true` in `tsconfig.json`).
- **ES modules** — `"type": "module"` in package.json.
- **Target ESNext** — use modern syntax freely.

### Imports

- Use `.ts` extensions on relative imports: `import { foo } from "./bar.ts"`
- Absolute imports from `agent/src/` use relative paths only — no path aliases.
- Group imports: stdlib / node builtins first, then third-party, then local.

### Naming

| Kind | Convention | Example |
|---|---|---|
| Variables / functions | camelCase | `runCard`, `ensureWorktree` |
| Types / interfaces / classes | PascalCase | `ExecResult`, `AuthError` |
| Files | kebab-case | `invoke-claude.ts`, `dispatcher.test.ts` |
| Test files | `*.test.ts` | colocated with source |
| Constants | UPPER_SNAKE_CASE | `STARTUP_HOLD_MS` |

### Types

- **No `any`** — use `unknown` + narrowing, or proper types.
- **Explicit return types** on exported functions.
- **Interfaces** for object shapes, **type aliases** for unions/intersections.
- Use `as const` for literal types when appropriate.

### Error Handling

- **Custom error classes** for domain-specific failures: `AuthError`, `RateLimitError` extend `Error`.
- **Throw for exceptional conditions**, return `Result`-style objects for expected failures.
- **Non-zero exit codes are returned, not thrown** — see `exec.ts`.
- Catch errors at boundaries (dispatcher, adapter layer), log to board, resolve gracefully.

### Functions

- Small, single-purpose. One responsibility per function.
- Pure functions where possible; side effects at edges.
- Async/await over `.then()` chains.

### Testing

- **Framework:** `bun:test` — `describe`, `it`, `expect`, `beforeEach`, `afterEach`.
- **Pattern:** Arrange → Act → Assert.
- **Temp dirs** for filesystem tests — clean up in `afterEach`.
- **Mock dependencies** via dependency injection (see `RunCardDeps` pattern).
- **No network calls** in unit tests — mock external services.

## Git Workflow

- **All commits to `dev`** — never commit to `main`.
- **One worktree per task** — `git worktree add worktrees/<slug> -b <slug>`.
- **Commit message format:** `<slug>/iter-<n>: <one-line summary>` (per iteration), `<slug>: <description>` (squashed on ship).
- **Lowercase, imperative** — no AI attribution, no `Co-Authored-By`.

## File Layout

```
agent/src/          # Core agent logic (TypeScript)
  loop/             # Iteration loop, claude invocation, adapters
  git/              # Git operations
  adapters/         # External system adapters
  runner/           # Card execution
board/              # Next.js web app (React, Tailwind 4)
scripts/            # Test scripts, e2e utilities
bin/                # CLI commands (shell scripts)
workspaces/memory/  # Agent memory (ST/LT)
```

## Principles

- **CLI governs process** — agents use CLI commands, never write board files directly.
- **Memory over repetition** — save lessons to `memory add --st` immediately.
- **Computed state over stored state** — derive values, don't store them.
- **Worktree isolation** — each agent owns its worktree, no concurrent writes.
