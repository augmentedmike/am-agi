# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Bootstrap

**Run this first, every session:**

```sh
source ./init.sh
```

This adds `$HOME/am/bin` to `PATH` and makes the CLI commands executable. No CLI commands work before this. `bin/` is tracked in the repo — commands live there directly.

## CLI Commands

All process actions go through CLI. Agents never write to board files directly.

| Command | Description |
|---|---|
| `board create --title <title> [--priority critical\|high\|normal\|low] [--attach <path>...]` | Create a card (starts in `backlog`) |
| `board move <id> <state>` | Transition a card — gates enforced |
| `board update <id> [--title <title>] [--priority <priority>] [--log <msg>] [--attach <path>...]` | Update fields / append work log |
| `board show <id>` | Print full card content |
| `board search [--state <state>] [--priority <priority>] [--text <query>] [--all]` | Query cards |
| `board archive <id> [--reason <msg>]` | Move card to `board/archive/` |
| `new-next <name>` | Scaffold Next.js workspace (TypeScript, Tailwind 4, Bun, Turbopack, Vercel) |

## Kanban State Machine

```
backlog → in-progress → in-review → shipped
```

| Transition | Gate |
|---|---|
| backlog → in-progress | `criteria.md` written, context gathered |
| in-progress → in-review | All criteria have implementation |
| in-review → shipped | All criteria verified, tests pass |
| in-review → in-progress | Verification failed — log failure, resume work |

Priority order within a state: `critical → high → normal → low`. Always work the highest-priority in-progress card. If none, pull the highest-priority backlog card.

## Agent Loop (Wiggum)

Each iteration is one-shot: do exactly one unit of work, commit, exit. No state is carried in memory — all state lives in files.

**Pre:**
```sh
source ./init.sh
git worktree add ../am-<task-slug> -b <task-slug>
# all reads/writes happen inside the worktree
```

**Per iteration:**
1. Read `todo.md` and check board state
2. Read `work.md` (source of truth — never modify it)
3. Generate `criteria.md` on first run
4. Do one meaningful unit of work for the current board column
5. Write `iter/<n>/agent.log`
6. Rewrite `todo.md` (check off completed steps, note what's next)
7. `git add -A && git commit -m "<task-slug>/iter-<n>: <one-line summary>"`

**What each column means:**

| Column | Work |
|---|---|
| backlog | Research, read docs, gather context, write `criteria.md` |
| in-progress | Write code, create files, make changes |
| in-review | Run tests, verify each criterion in `criteria.md` |
| shipped | Trigger post hook |

## Ship Script

Run verbatim when a task reaches `shipped`:

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

One atomic commit per task on a clean linear trunk.

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
bin/             # CLI commands (gitignored, populated at runtime)
docs/            # process documentation
```

## Design Principles

| Principle | Rule |
|---|---|
| CLI governs process | Every workflow action goes through a CLI command. The command encodes the logic; the agent supplies arguments. |
| No model memory | All state lives in files: `todo.md`, `criteria.md`, board cards, `iter/*/agent.log`. |
| Computed state over stored state | Any value derivable from other data (counts, IDs, order) is computed, not stored. Stored derived state creates staleness bugs. |
| Worktree isolation | Each agent owns its own worktree. Concurrent agents cannot stomp on each other. |

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
