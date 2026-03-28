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
| `vault init` | Generate age keypair in `~/.ssh/` (once per machine) |
| `vault set <key> [value]` | Encrypt and store one secret |
| `vault get <key>` | Decrypt and print one secret (use inline: `$(vault get key)`) |
| `vault list` | List secret key names — no values ever printed |
| `memory add "content" [--st\|--lt] [--topic <slug>]` | Save a memory (auto-routes ST vs LT) |
| `memory recall "query" [--limit <n>]` | Retrieve relevant memories (ST always + LT ranked search) |
| `memory list [--st\|--lt]` | List all memories |
| `memory rm <slug-or-id>` | Delete a memory |

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

Priority order within a state: `critical → high → normal → low`. Always work the highest-priority in-progress card. If none, pull the highest-priority backlog card. `board search` output is sorted by priority in this same order — the first result is always the highest-priority match.

## Agent Loop (Wiggum)

Each iteration is one-shot: do exactly one unit of work, commit, exit. No state is carried in memory — all state lives in files.

**Pre:**
```sh
source ./init.sh
git checkout dev && git pull origin dev
git worktree add worktrees/<task-slug> -b <task-slug>
# all reads/writes happen inside the worktree
```

**Per iteration:**
1. Read `todo.md` and check board state
2. **Pull memory context** — run `memory recall "$(head -5 todo.md)"` and read every line before proceeding. Short-term rules apply unconditionally. Long-term results are context.
3. Read `work.md` (source of truth — never modify it)
4. Generate `criteria.md` on first run
5. Do one meaningful unit of work for the current board column
6. If you hit an unexpected constraint, error, or "never do this" insight → `memory add --st "lesson"` before committing
7. Write `iter/<n>/agent.log`
8. Rewrite `todo.md` (check off completed steps, note what's next)
9. `git add -A -- ':!research.md' ':!criteria.md' ':!todo.md' ':!work.md' ':!iter/' ':!apps/' ':!.next/' && git commit -m "<task-slug>/iter-<n>: <one-line summary>"`

**What each column means:**

| Column | Work |
|---|---|
| backlog | Research, read docs, gather context, write `criteria.md` |
| in-progress | Write code, create files, make changes |
| in-review | Run tests, verify each criterion in `criteria.md` |
| shipped | Trigger post hook |

## Branch Model

| Branch | Purpose |
|---|---|
| `dev` | Integration branch — all work lands here. board-deploy deploys from `dev`. |
| `main` | Stable releases only. Never commit directly. Merge from `dev` only when verified. |
| `<feature-slug>` | Short-lived branches off `dev`. |

**All commits go to `dev`. Never commit to `main`.**

## Ship Script

Run verbatim when a task reaches `shipped`:

```sh
# Squash all iteration commits
git reset $(git merge-base HEAD origin/dev)
git add -A -- ':!research.md' ':!criteria.md' ':!todo.md' ':!work.md' ':!iter/' ':!apps/' ':!.next/'
git commit -m "<task-slug>: <description>"

# Rebase and merge into dev
git fetch origin
git rebase origin/dev
git checkout dev
git merge --ff-only <task-slug>
git push origin dev

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
workspaces/
  memory/
    st/          # short-term: *.md rules/lessons, always read by agents
    lt/
      memory.db  # long-term: FTS5 SQLite, ranked search
    archive/     # ST entries promoted to LT by `reflection`
    consolidate.log
bin/             # CLI commands (gitignored, populated at runtime)
docs/            # process documentation
```

## Design Principles

| Principle | Rule |
|---|---|
| CLI governs process | Every workflow action goes through a CLI command. The command encodes the logic; the agent supplies arguments. |
| Memory over repetition | Lessons learned are saved to `memory` immediately. Never let an agent repeat a mistake that has already been corrected. |
| No model memory | All state lives in files: `todo.md`, `criteria.md`, board cards, `iter/*/agent.log`. Persistent knowledge lives in `workspaces/memory/`. |
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
