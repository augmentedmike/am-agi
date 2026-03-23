# Agent Loop

The agent loop (dubbed "wiggum") is a one-shot agentic iteration pattern. Each run of the loop does exactly one unit of work, then updates state for the next run.

## Loop Flow

```
[pre] → work.md → criteria.md → todo.md → [work] → commit iteration → update todo.md → [post on ship]
```

### Pre: Bootstrap
Every agent session begins by running `init.ts` to ensure the environment is configured — `PATH`, and any other env vars the CLI tools depend on. No CLI commands should be invoked before this runs.

```
source ./init.sh
```

### Pre: Worktree Setup
After bootstrapping, the loop creates an isolated git worktree and branch for this unit of work. This ensures concurrent agents never stomp on each other in the filesystem — each agent owns its own working tree.

```
git worktree add ../am-<task-slug> -b <task-slug>
```

All reads and writes during the iteration happen inside this worktree. The branch name matches the task so the history is self-documenting.

### 1. work.md
Defines the work description. This is the source of truth for what needs to be built or done. Written by a human or upstream process — the loop reads it, never modifies it.

### 2. criteria.md
Generated from work.md on first run. Defines the acceptance criteria — what "done" looks like. Used during the in-review phase to verify completion.

### 3. todo.md
A flat checklist of concrete steps the agent needs to take to complete the current work. Generated from work.md and criteria.md on first run. It is not a kanban — it has no columns, no state machine, no card structure. It is a scratchpad: an ordered list of what to do, what was done, and what's left. The board tracks the task at the macro level; todo.md tracks the steps at the micro level.

### 4. Work (per column)

| Column | What the loop does |
|---|---|
| **backlog** | Research and prep — reads docs, explores codebase, gathers context, breaks work into tasks |
| **in progress** | Actual implementation — writes code, creates files, makes changes |
| **in review** | Verifies against criteria.md — runs tests, checks acceptance criteria, flags failures |
| **shipped** | Triggers the post hook — squash, rebase, merge, cleanup |

### 5. Iteration Commit
At the end of every one-shot iteration — before exiting — the agent commits everything in the worktree. This captures a complete snapshot of the iteration: what changed, the updated todo.md, the artifacts, and the Claude Code JSON I/O.

```
git add -A
git commit -m "<task-slug>/iter-<n>: <one-line summary>"
```

Every iteration commit includes:

| File | Description |
|---|---|
| `iter/<n>/agent.log` | Log produced by the agent — the result of the iteration's work |
| `todo.md` | Updated step checklist reflecting post-iteration state |

The JSON I/O is a Claude Code feature used at runtime. It is not persisted — only the resulting log is committed.

This gives complete observability into how the system worked: every action, every decision, all in git history.

### 6. Update todo.md
At the end of every one-shot iteration, the loop rewrites todo.md — checking off completed steps, noting what was learned, and listing what remains. This is the handoff to the next iteration. The board is updated separately via `board` CLI commands to reflect any state transitions.

### Post: Ship Hook
When a task reaches `shipped`, the post hook squashes all iteration commits down to a single clean commit, then merges to main:

```
# squash all iteration commits into one
git reset $(git merge-base HEAD origin/main)
git add -A
git commit -m "<task-slug>: <description>"

# rebase onto current main and merge
git fetch origin
git rebase origin/main
git checkout main
git merge --ff-only <task-slug>
git push origin main

# cleanup
git worktree remove ../am-<task-slug>
git branch -d <task-slug>
```

The squash collapses all iteration noise into one atomic commit per task. The full iteration history (JSON I/O, agent logs) is preserved inside that commit — it's all there, just not cluttering the trunk log.

## Git History Shape

The goal is a clean, vertical trunk:

```
main
  │
  ○  task-c: add scoring logic
  │
  ○  task-b: scaffold data model
  │
  ○  task-a: research API shape
  │
```

No branches visible in the log. Each commit is one completed task containing the full iteration record. The worktree isolation guarantees agents work in parallel without conflict — the rebase step resolves ordering at merge time.

## One-Shot Contract

Each iteration:
- Runs in its own git worktree + branch (pre)
- Reads todo.md (current step checklist) and checks the board for task state
- Does exactly one meaningful unit of work
- Writes `iter/<n>/agent.log` — the log produced by the iteration
- Rewrites todo.md
- Commits everything before exiting
- On ship: squashes iterations to one commit, rebases, merges to main (post)
- Does not carry memory between runs — all state lives in files

## File Layout

```
work.md              # input — describes the work (never modified by loop)
criteria.md          # generated — acceptance criteria
todo.md              # scratchpad — flat checklist for the current iteration
iter/
  1/
    agent.log        # log from iteration 1
  2/
    agent.log
  ...
```
