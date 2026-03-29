# CLI Reference

All workflow actions go through CLI commands. Agents never write to board files directly.

Run `source ./init.sh` in every session before using any of these commands.

---

## board

The agent's only interface to card state.

### board create

Create a new card. Cards start in `backlog`.

```sh
board create --title <title> [--priority critical|high|normal|low] [--attach <path>...]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--title` | yes | Card title |
| `--priority` | no | `critical`, `high`, `normal` (default), or `low` |
| `--attach` | no | Absolute file path to attach (repeatable) |

Examples:
```sh
board create --title "Add user auth"
board create --title "Fix: search returns archived cards" --priority high
board create --title "Research: SQLite vs Postgres at scale" --priority normal
```

---

### board move

Transition a card to a new state. Gate-enforced — if the gate fails, specific failures are printed.

```sh
board move <id> <state>
```

Valid states: `backlog`, `in-progress`, `in-review`, `shipped`

Examples:
```sh
board move abc123 in-progress
board move abc123 in-review
board move abc123 shipped
```

If the gate rejects, you'll see messages like:
```
gate failed:
  - criteria.md not attached
  - research.md is empty
```

Address each failure and retry.

---

### board update

Update fields on an existing card.

```sh
board update <id> [--title <title>] [--priority <priority>] [--log <message>] [--attach <path>...] [--workdir <path>] [--version <version>]
```

| Flag | Description |
|------|-------------|
| `--title` | New title |
| `--priority` | New priority |
| `--log` | Append a timestamped work log entry |
| `--attach` | Add an attachment (absolute path, repeatable, accumulates) |
| `--workdir` | Register the card's git worktree path |
| `--version` | Stamp a version tag on the card |

Examples:
```sh
board update abc123 --log "found the issue in apps/board/src/worker/gates.ts:42"
board update abc123 --attach /Users/me/am/worktrees/my-card/criteria.md
board update abc123 --priority critical
board update abc123 --workdir /Users/me/am/worktrees/my-card
board update abc123 --version 0.0.18
```

---

### board show

Print a card's full content: frontmatter and work log.

```sh
board show <id>
```

---

### board search

Query cards.

```sh
board search [--state <state>] [--priority <priority>] [--text <query>] [--all]
```

| Flag | Description |
|------|-------------|
| `--state` | Filter by state: `backlog`, `in-progress`, `in-review`, `shipped` |
| `--priority` | Filter by priority |
| `--text` | Full-text search over title and work log |
| `--all` | Include archived cards |

Results are sorted by priority: `critical → high → normal → low`.

Examples:
```sh
board search --state in-progress
board search --priority critical
board search --text "auth"
board search --state in-review --text "test failure"
board search --all --text "email"
```

---

### board archive

Remove a card from the active board without deleting it. Archived cards don't appear in default searches.

```sh
board archive <id> [--reason <message>]
```

Examples:
```sh
board archive abc123 --reason "won't fix — out of scope"
board archive abc123 --reason "superseded by card xyz789"
```

---

## memory

See [Memory System](05-memory-system.md) for the full reference.

```sh
memory add "content" [--st|--lt] [--topic <slug>]
memory recall "query" [--limit <n>]
memory list [--st|--lt]
memory rm <slug-or-id>
```

---

## vault

See [Vault](06-vault.md) for the full reference.

```sh
vault init
vault set <key> [value]
vault get <key>
vault list
vault rm <key>
```

---

## new-next

Scaffold a new Next.js workspace (TypeScript, Tailwind 4, Bun, Turbopack, Vercel).

```sh
new-next <name>
```

Creates `workspaces/<name>/` with the standard stack pre-configured.

---

## Other bin/ tools

| Command | Description |
|---------|-------------|
| `dispatcher` | Agent loop — watches board, runs iterations (run by launchagent, not manually) |
| `board-deploy` | Deploy board app to production |
| `board-serve` | Serve board locally |
| `bump` | Bump version in package.json |
| `reflection` | Promote ST memories to LT (run periodically) |
| `ship-hook` | Post-ship cleanup (squash, rebase, merge) — called by dispatcher |
| `daily-report` | Generate a daily summary of shipped cards |
| `watch-next` | Watch and rebuild a Next.js workspace |
