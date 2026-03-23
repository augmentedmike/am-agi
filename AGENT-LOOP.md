# Wiggum Loop

The wiggum loop is a one-shot agentic iteration pattern. Each run of the loop does exactly one unit of work, then updates state for the next run.

## Loop Flow

```
[pre] → work.md → criteria.md → todo.md → [work] → update todo.md → [post on ship]
```

### Pre: Worktree Setup
Before any work begins, the loop creates an isolated git worktree and branch for this unit of work. This ensures concurrent agents never stomp on each other in the filesystem — each agent owns its own working tree.

```
git worktree add ../am-<task-slug> -b <task-slug>
```

All reads and writes during the iteration happen inside this worktree. The branch name matches the task so the history is self-documenting.

### 1. work.md
Defines the work description. This is the source of truth for what needs to be built or done. Written by a human or upstream process — the loop reads it, never modifies it.

### 2. criteria.md
Generated from work.md on first run. Defines the acceptance criteria — what "done" looks like. Used during the in-review phase to verify completion.

### 3. todo.md
A kanban-style task list with columns: `backlog`, `in progress`, `in review`, `shipped`. Created from work.md and criteria.md on first run. Updated at the end of every iteration.

### 4. Work (per column)

| Column | What the loop does |
|---|---|
| **backlog** | Research and prep — reads docs, explores codebase, gathers context, breaks work into tasks |
| **in progress** | Actual implementation — writes code, creates files, makes changes |
| **in review** | Verifies against criteria.md — runs tests, checks acceptance criteria, flags failures |
| **shipped** | Triggers the post hook — commit, rebase, merge, cleanup |

### 5. Update todo.md
At the end of every one-shot iteration, the loop writes its updated todo.md reflecting what moved, what was learned, and what comes next. This is the handoff to the next iteration.

### Post: Ship Hook
When a task reaches `shipped`, the post hook runs inside the worktree branch:

```
git add -A
git commit -m "<task-slug>: <description>"
git fetch origin
git rebase origin/main
git checkout main
git merge --ff-only <task-slug>
git push origin main
git worktree remove ../am-<task-slug>
git branch -d <task-slug>
```

The rebase-before-merge pattern keeps the tree linear — no merge commits, no octopus tangles. History reads as a straight vertical line of atomic task commits.

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

No branches visible in the log. Each commit is one completed task. The worktree isolation guarantees agents work in parallel without conflict — the rebase step resolves ordering at merge time.

## One-Shot Contract

Each iteration:
- Runs in its own git worktree + branch (pre)
- Reads current state from todo.md
- Does exactly one meaningful unit of work
- Writes updated todo.md before exiting
- Commits, rebases, and merges to main on ship (post)
- Does not carry memory between runs — all state lives in files

## File Layout

```
work.md        # input — describes the work (never modified by loop)
criteria.md    # generated — acceptance criteria
todo.md        # state — kanban board, updated each iteration
```
