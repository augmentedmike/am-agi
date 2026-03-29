# Kanban & Cards

## The State Machine

```
backlog → in-progress → in-review → shipped
                    ↑_______________|
                    (failure route — always allowed)
```

Cards move through four states. Transitions are gated — a card cannot skip states or be moved backward (except in-review → in-progress, which is always allowed).

---

## States

### backlog

The card exists but work hasn't started. This is where AM researches and prepares.

What AM does here:
- Reads the codebase or web sources
- Writes `criteria.md` — the numbered acceptance criteria
- Writes `research.md` — context, file references, or URLs
- Writes `todo.md` — a flat checklist of implementation steps
- Attaches all three files to the card
- Attempts `board move <id> in-progress`

**Gate to leave backlog:**
- `criteria.md` is attached, exists, non-empty, and contains numbered items (`1. ...`)
- `research.md` is attached, exists, non-empty, and contains at least one file path (for code tasks) or URL/citation (for non-code tasks)
- Card title is non-empty

### in-progress

Active implementation. AM writes code, creates files, makes changes.

What AM does here:
- Works through `todo.md` step by step
- Commits after each meaningful unit of work
- Attempts `board move <id> in-review` when all todo items are checked off and tests pass

**Gate to leave in-progress:**
- `todo.md` has no unchecked items (`- [ ]`)
- If test files exist in the worktree: `bun test` exits 0

### in-review

Verification. AM runs tests and checks each criterion in `criteria.md`.

What AM does here:
- Checks each criterion — writes `✓ <criterion>` or `✗ <criterion>` to `iter/<n>/agent.log`
- Runs `bun test`
- On all pass: attempts `board move <id> shipped`
- On any fail: logs the failure, attempts `board move <id> in-progress`

**Gate to leave in-review → shipped:**
- `iter/<n>/agent.log` contains `✓` for every criterion in `criteria.md`
- `bun test` exits 0

**Gate to leave in-review → in-progress:**
- Always allowed (failure route)

### shipped

Work is verified and complete. The ship script runs:
1. Squash all iteration commits to one
2. Rebase onto `origin/dev`
3. Fast-forward merge to `dev`
4. Push
5. Clean up worktree and branch

Terminal state — cards do not leave shipped.

---

## Priorities

| Priority | Meaning |
|----------|---------|
| **critical** | Blocks other cards or a hard deadline. Do first. |
| **high** | Important — do before normal work. |
| **normal** | Default. Do in order. |
| **low** | Do when nothing else is waiting. |

The dispatcher always works the highest-priority card. `board search` results are sorted `critical → high → normal → low` — the first result is always the highest-priority match.

---

## Card Format

Cards are `.qmd` files with YAML frontmatter. You never edit them directly — only through `board` commands.

```markdown
---
id: abc123
title: Add email digest
state: in-progress
priority: high
attachments:
  - /path/to/criteria.md
  - /path/to/research.md
  - /path/to/todo.md
workDir: /Users/you/am/worktrees/add-email-digest
created: 2026-03-23T14:00Z
updated: 2026-03-23T14:18Z
---

## Work Log

- 2026-03-23T14:00Z — card created
- 2026-03-23T14:18Z — moved to in-progress
```

---

## Attachments

Attachments are file paths pinned to a card for reference. They must be absolute paths — the gate worker calls `existsSync()` on them.

```sh
board update <id> --attach /absolute/path/to/criteria.md
```

Attachments accumulate — `--attach` adds without removing existing ones.

---

## Work Log

Each `board move` and `board update --log` call appends a timestamped entry to the card's work log. You can read the full history with `board show <id>`.

---

## Card Worktrees

Each card owns its own git worktree for its entire lifespan:

```
worktrees/<card-slug>/
  work.md           # source of truth — never modified by AM
  criteria.md       # acceptance criteria
  research.md       # context gathered in backlog
  todo.md           # flat checklist
  iter/
    1/agent.log
    2/agent.log
```

The worktree path is stored on the card as `workDir`. Gate checks that need the filesystem (test files, iter logs, criteria.md) use this path.
