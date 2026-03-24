Read steps/6.md, docs/CLI.MD, docs/KANBAN.MD, and CLAUDE.md. Build the `board` CLI tool at `bin/board` as a TypeScript script run via Bun (`#!/usr/bin/env bun`).

The board CLI is the agent's only interface to card state. It talks to the board's SQLite database via the API (`http://localhost:3000/api`). It does not touch the database directly.

**Commands to implement:**

`board create --title <title> [--priority critical|high|normal|low] [--attach <path>...]`
- POST /api/cards
- Prints: `created <id>` on success

`board move <id> <state>`
- POST /api/cards/<id>/move
- The API's gate worker does the verification — the CLI just makes the call and surfaces the result
- On rejection (422): print each failure reason on its own line, exit 1
- On success: print `moved <id> to <state>`

`board update <id> [--title <title>] [--priority <priority>] [--log <message>] [--attach <path>...]`
- PATCH /api/cards/<id>
- Prints: `updated <id>`

`board show <id>`
- GET /api/cards/<id>
- Prints the full card as formatted Markdown: frontmatter block then work log timeline

`board search [--state <state>] [--priority <priority>] [--text <query>] [--all]`
- GET /api/cards with query params
- Prints a table: id | title | state | priority, one card per line, sorted priority desc

`board archive <id> [--reason <message>]`
- POST /api/cards/<id>/archive
- Prints: `archived <id>`

Code quality:
- CLI argument parsing via a minimal hand-written parser — no commander/yargs (keep the binary dependency-free)
- All API calls go through a single `apiClient(method, path, body?)` function with typed responses
- Exit codes: 0 = success, 1 = gate rejection or validation error, 2 = unexpected error
- Every command prints to stdout on success, stderr on error — never mix them

Definition of done:
- `board create --title "test card"` creates a card and prints its id
- `board move <id> in-progress` on a backlog card with no memory files prints the specific missing file failures and exits 1
- `board move <id> in-progress` on a backlog card with all memory files in place succeeds and prints the new state
- `board show <id>` outputs valid Markdown with frontmatter and work log
- `board search --state backlog` returns only backlog cards sorted by priority
- `bun test` passes for: all gate conditions, CLI argument parsing, apiClient error handling