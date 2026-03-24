# NEXT_STEPS.md

Postmortem and remaining work from the first full build run (steps 1–6).

---

## What Was Built

Steps 1–6 are complete and squash-merged to main:

| Commit | What |
|---|---|
| `ee16162` | baseline — all step prompts |
| `1ed89a4` | step 2 — Wiggum loop (`agent/src/loop/`) |
| `5fc4e38` | step 3 — runner + `bin/am` |
| `9aa3808` | step 4 — Claude invoker + git helpers (`agent/src/claude/`, `agent/src/git/`) |
| `e765e7e` | step 5 — Kanban board (`apps/board/`) |
| `92dae59` | step 6 — `bin/board` CLI + gate worker |

---

## Bugs Found and Fixed (In-Session)

These were fixed inline during the run. They are already in the code but NOT yet reflected in the step prompts at baseline. Next run they will recur unless the prompts are updated.

### 1. `invokeClaude` missing `cwd`

**File:** `agent/src/loop/invoke-claude.ts`
**Bug:** Claude was spawned without `cwd: workDir`, so it ran in the main repo instead of the worktree. All file writes landed in the wrong place.
**Fix:** Pass `cwd: workDir` to the spawn options.
**Status:** Fixed in code. Already baked into `steps/2.md` prompt.

### 2. Runner `extractSummary` using raw JSON as commit message

**File:** `agent/src/runner/index.ts`
**Bug:** `extractSummary` took the first line of `result`, but `result` was raw Claude JSON stdout. Commit messages looked like `iter: {"type":"result","subtype":"success"...`.
**Fix:** Parse JSON first, extract the `result` field, then take first line truncated to 72 chars.
**Status:** Fixed in code. Already baked into `steps/3.md` prompt.

---

## Bugs NOT Fixed — Need Clean-Session Work

### 3. Squash commit loses all iteration history

**Where it matters:** `bin/am` ship script, `shipCard()` in `agent/src/git/commit.ts`
**Bug:** When squashing iteration commits (`git reset $(git merge-base HEAD origin/main)`), all `iter: <summary>` commit messages are discarded. The squash commit body is empty — no record of what happened during each iteration.
**Fix:** Before the reset, collect all iteration commit messages with `git log --format="%s%n%b" main..HEAD` and use them as the body of the squash commit:
```bash
ITER_LOG=$(git log --reverse --format="### %s%n%b" $(git merge-base HEAD origin/main)..HEAD)
git reset $(git merge-base HEAD origin/main)
git add -A
git commit -m "<slug>: <description>

$ITER_LOG"
```
**Where to fix:** `shipCard()` in `agent/src/git/commit.ts` AND the ship script in CLAUDE.md.

**Recovery option for this session's lost history:** The iter commits from steps 4–6 may still be recoverable via reflog before git GC runs. `git reflog` would show the dangling commits. Collect them with:
```bash
git reflog --all | grep "iter:" | awk '{print $1}' | xargs -I{} git log --format="%s" -1 {}
```
Do this before running `git gc` or waiting too long — reflog entries expire.

### 4. `iter/<n>/agent.log` files never committed

**Where it matters:** Verification gate, audit trail, `iter/<n>/agent.log` is required by the `in-review → shipped` gate check.
**Bug:** The loop writes no `iter/<n>/agent.log`. Claude runs and produces output but the agent never writes the log to the worktree. The runner commits after each iteration but there's nothing in `iter/` to commit.
**Fix:** The runner (or loop) must write `iter/<n>/agent.log` after each iteration. The iteration number can be derived by counting existing `iter/` directories. The log content is the `result` field from Claude's output.
**Where to fix:** `agent/src/runner/index.ts` — after each `runIteration` call, write `iter/<n>/agent.log` before committing.

### 5. `work.md` cherry-pick conflicts

**Where it matters:** Shipping worktrees to main.
**Bug:** Each worktree has its own `work.md` (the task description written by `bin/am`). When cherry-picking squash commits onto main, `work.md` conflicts because main already has a `work.md` from a previous step.
**Fix:** `work.md` should NOT live in the repo root — it should live inside a subdirectory that is gitignored, or `work.md` should be excluded from the squash commit. Alternatively, `bin/am` should create the worktree with `work.md` outside the git-tracked tree, or add `work.md` to `.gitignore`.
**Simplest fix:** Add `work.md` to `.gitignore`. It's transient input, not a repo artifact.

### 6. Sequential worktree derivation

**Where it matters:** Steps 4, 5, 6 (and any future parallel tasks that touch overlapping files).
**Bug:** Steps 4, 5, and 6 were all branched from main at step 3. They are siblings, not sequential. Step 6 built `apps/board/src/worker/gates.ts` without step 5's board underneath it — required manual conflict resolution at ship time.
**Fix:** For tasks that depend on each other, `bin/am` or the orchestrator must branch the new worktree from the tip of the dependency, not from main. This is a workflow problem — the `board` CLI (step 6) explicitly depends on the board app (step 5). The KANBAN.MD should document that dependent tasks must be sequenced.
**Interim fix:** When shipping, always rebase the dependent worktree onto main after the dependency is merged before squashing.

---

## Remaining Build Work

### 7. `bin/board` is not committed to main

`bin/board` is gitignored (all of `bin/` is gitignored per CLAUDE.md). It was built in step 6's worktree but lives in `bin/` which is never tracked. Unlike `bin/am` (which is intentionally runtime-only), `bin/board` is a first-class CLI tool that should be committed.
**Fix:** Either move `bin/board` to a committed location (`scripts/board`, `cli/board`) or add `!bin/board` exception to `.gitignore`.

### 8. `init.sh` does not populate `bin/board`

`init.sh` adds `$HOME/am/bin` to PATH but does not create `bin/board`. After a fresh clone, `board` is not available.
**Fix:** `init.sh` should symlink or copy `bin/board` into place (or `bin/board` should just be committed).

### 9. Board dev server uses `npm run dev` not `bun run dev`

The board app uses `better-sqlite3` which cannot be loaded by Bun directly. The dev server must be started with `npm run dev` (via Node/tsx). `bun run dev` fails with `ERR_DLOPEN_FAILED`.
**Fix options:** Either switch to `bun:sqlite` + `drizzle` compatible with Bun, or document that the board runs under Node and update `apps/board/package.json` scripts to use `tsx`/`node` explicitly.

### 10. No `new-next` command

Step 5's prompt says "scaffold with `new-next board` first" but `new-next` does not exist. The agent worked around it by scaffolding manually. The `new-next` CLI needs to be built (referenced in CLAUDE.md as a board command).

---

## Priority Order for Next Session

1. Fix `work.md` in `.gitignore` — prevents cherry-pick conflicts, zero risk
2. Fix `iter/<n>/agent.log` writing in runner — gate checks require it, blocks `in-review → shipped`
3. Fix squash commit body to include iter log — audit trail
4. Commit or properly expose `bin/board`
5. Fix `init.sh` to make `board` available after `source ./init.sh`
6. Build `new-next` CLI
7. Decide on Bun vs Node for board dev server
