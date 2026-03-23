# am

Amelia's monorepo — tooling, docs, and workspaces.

## Structure

```
am/
├── bin/          # CLI scripts (add to PATH)
├── docs/         # Reference documentation
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
