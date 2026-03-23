# CLI

Agents do software development work — writing code, modifying databases, building systems. What the CLI tools govern is the *process* layer: workflow state, task management, board operations. By separating process from development, agents cannot hallucinate their way through workflow logic. The command encodes the logic; the agent supplies the arguments.

## Design Principle

Every process action the agent takes — creating a card, moving it, searching the board — goes through a CLI command. This removes an entire class of hallucination errors from the workflow layer while leaving the agent free to do real development work.

---

## board

Manages kanban cards. Cards are Markdown files with YAML frontmatter. Search is powered by QMD (Quarto Markdown), which indexes frontmatter fields and body content for structured querying.

### Card Format

Each card is a `.qmd` file. Frontmatter carries structured metadata; the body is free Markdown.

```markdown
---
id: task-001
title: Scaffold data model
state: backlog
priority: normal
attachments: []
created: 2026-03-23T14:00Z
updated: 2026-03-23T14:00Z
---

## Work Log

- 2026-03-23T14:00Z — card created
```

---

### board create

Create a new card on the board.

```
board create --title <title> [--priority critical|high|normal|low] [--attach <path>...]
```

- Assigns a unique `id` (slug derived from title)
- Sets initial `state` to `backlog`
- Defaults `priority` to `normal`
- Writes the `.qmd` card file
- Appends a work log entry: `card created`

---

### board update

Update fields on an existing card.

```
board update <id> [--title <title>] [--priority <priority>] [--log <message>] [--attach <path>...]
```

- Updates any specified frontmatter fields
- `--log` appends a timestamped entry to the work log
- `--attach` adds a path to the attachments list (does not remove existing)
- Bumps `updated` timestamp

---

### board move

Transition a card to a new state. Gates are enforced by the command — invalid transitions are rejected with an error explaining which gate was not met.

```
board move <id> <state>
```

Valid states: `backlog`, `in-progress`, `in-review`, `shipped`

- Enforces transition gates defined in kanban.md
- Appends a work log entry: `moved to <state>`
- Bumps `updated` timestamp
- On `shipped`: triggers the post hook (commit, rebase, merge)

---

### board archive

Remove a card from the active board without deleting it.

```
board archive <id> [--reason <message>]
```

- Moves the card file to `board/archive/`
- Appends a work log entry: `archived — <reason>`
- Archived cards do not appear in default `board search` results

---

### board search

Query cards using QMD-powered search. Searches both frontmatter fields and body content.

```
board search [--state <state>] [--priority <priority>] [--text <query>] [--all]
```

- `--state` filters by kanban state
- `--priority` filters by priority level
- `--text` full-text search over title, work log, and body
- `--all` includes archived cards
- Returns a list of matching cards with `id`, `title`, `state`, `priority`

Examples:
```
board search --state in-progress
board search --priority critical
board search --text "scoring logic"
board search --state in-review --text "test failure"
```

---

### board show

Print a card's full content.

```
board show <id>
```

Outputs the complete `.qmd` file — frontmatter and body — to stdout.

---

## File Layout

```
board/
  task-001.qmd
  task-002.qmd
  archive/
    task-000.qmd
```

Cards live in `board/`. Archived cards move to `board/archive/`. The agent never writes to these files directly — only through `board` commands.
