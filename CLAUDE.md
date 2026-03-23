# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

`am` is Amelia's monorepo — a scaffold and reference implementation for agent-driven software development. It defines the tooling, process docs, and workspace structure. Actual project workspaces live under `workspaces/` (gitignored) and are created via the `new-next` CLI command.

## Bootstrap

Every agent session starts with:

```sh
source ./init.sh
```

This adds `$HOME/am/bin` to PATH. No CLI commands should run before this. The `bin/` directory is gitignored and populated at runtime.

## CLI Commands

Commands live in `bin/` (on PATH after bootstrap). Process actions always go through CLI — agents never write to board files directly.

| Command | Description |
|---|---|
| `board create --title <title> [--priority critical\|high\|normal\|low] [--attach <path>...]` | Create a backlog card |
| `board move <id> <state>` | Transition a card (gates enforced) |
| `board update <id> [--title ...] [--priority ...] [--log <msg>] [--attach <path>...]` | Update card fields / append work log |
| `board show <id>` | Print full card content |
| `board search [--state ...] [--priority ...] [--text ...] [--all]` | Query cards |
| `board archive <id> [--reason <msg>]` | Move card to `board/archive/` |
| `new-next` | Scaffold a new Next.js workspace (TypeScript, Tailwind 4, Bun, Turbopack, Vercel) |

## Kanban State Machine

Cards flow: `backlog → in-progress → in-review → shipped`

Transitions are gated — the `board move` command enforces them:

| Transition | Gate |
|---|---|
| backlog → in-progress | `criteria.md` written, context gathered |
| in-progress → in-review | All criteria have implementation |
| in-review → shipped | All criteria verified, tests pass |
| in-review → in-progress | Verification failed (log the failure, resume work) |

Priority order within a state: critical → high → normal → low. Always work the highest-priority in-progress card. If none, pull the highest-priority backlog card.

## Agent Loop (Wiggum)

Each iteration is one-shot: do exactly one unit of work, commit, exit.

**Pre:**
1. `source ./init.sh`
2. Create isolated worktree: `git worktree add ../am-<task-slug> -b <task-slug>`
3. All reads/writes happen inside the worktree

**Per iteration:**
1. Read `todo.md` (step checklist) and check board state
2. Read `work.md` (source of truth — never modify it)
3. Generate `criteria.md` on first run (acceptance criteria)
4. Do one meaningful unit of work for the current board column
5. Write `iter/<n>/agent.log`
6. Rewrite `todo.md` (check off completed steps, note what's next)
7. Commit: `git add -A && git commit -m "<task-slug>/iter-<n>: <one-line summary>"`

**Post (on ship):**
```sh
# Squash all iteration commits
git reset $(git merge-base HEAD origin/main)
git add -A
git commit -m "<task-slug>: <description>"

# Rebase and merge
git fetch origin
git rebase origin/main
git checkout main
git merge --ff-only <task-slug>
git push origin main

# Cleanup
git worktree remove ../am-<task-slug>
git branch -d <task-slug>
```

The goal is a clean linear trunk — one atomic commit per task with full iteration history inside it.

## File Layout

```
work.md          # describes the work — read-only
criteria.md      # acceptance criteria — generated on first run
todo.md          # flat step checklist — rewritten each iteration
iter/
  <n>/
    agent.log    # iteration log
board/
  <task-id>.qmd  # kanban cards
  archive/       # archived cards
workspaces/      # project workspaces (gitignored)
bin/             # CLI commands (gitignored, added to PATH by init.sh)
docs/            # process documentation
```

## Design Principles

- **Process through CLI, not agent reasoning.** The CLI encodes workflow logic (gate transitions, commit sequences). Agents supply arguments; commands do the right thing deterministically.
- **No memory between iterations.** All state lives in files: `todo.md`, `criteria.md`, board cards, `iter/*/agent.log`.
- **Computed state over stored state.** Any value derivable from other data (counts, sequence IDs, order) should be computed, not stored — stored derived state creates staleness bugs.
- **Worktree isolation.** Concurrent agents each own their own worktree; they cannot stomp on each other.
