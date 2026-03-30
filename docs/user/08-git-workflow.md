# Git Workflow

---

## Branch model

| Branch | Purpose |
|--------|---------|
| `main` | Stable releases only. Never commit directly. Merge from `dev` only when verified. |
| `dev` | Integration branch. All work lands here. Board app deploys from `dev`. |
| `<task-slug>` | Short-lived feature branches off `dev`. One per card. |

**All agent commits go to a task-slug branch, then squash-merge into `dev`.**

---

## Commit rules

- **Lowercase imperative**: `fix login redirect`, not `Fixed login redirect` or `Fixes login redirect`
- **No AI attribution**: never add `Co-Authored-By: Claude` or similar
- **No `--no-verify`**: never skip hooks
- **Commit every meaningful unit of work** — don't batch unrelated changes

```sh
# Good
git commit -m "add vault set command"
git commit -m "fix round-robin cursor overflow"

# Bad
git commit -m "Added vault set command and fixed various bugs"
git commit -m "WIP"
```

---

## Banned operations

| Operation | Why banned | Alternative |
|-----------|-----------|-------------|
| `git stash` / `git stash pop` | Creates hidden state, causes lost work | Commit to a branch instead |
| `git push --force` to `main` | Destroys history | Never force-push main |
| `git commit --amend` (without explicit request) | Rewrites history silently | Create a new commit |
| `git reset --hard` (without explicit request) | Destroys uncommitted work | Use `git checkout <file>` for specific files |

---

## Worktree isolation

Each card gets its own git worktree:

```sh
git worktree add worktrees/<task-slug> -b <task-slug>
```

Concurrent agents work in separate worktrees and cannot conflict with each other. The worktree is removed after the card ships.

---

## Ship sequence

When a card reaches `shipped`, squash all iteration commits into one:

```sh
git reset $(git merge-base HEAD origin/dev)
git add -A -- ':!research.md' ':!criteria.md' ':!todo.md' ':!work.md' ':!iter/' ':!apps/' ':!.next/'
git commit -m "<task-slug>: <description>"
git fetch origin
git rebase origin/dev
git checkout dev
git merge --ff-only <task-slug>
git push origin dev
git worktree remove ../am-<task-slug>
git branch -d <task-slug>
```

One atomic commit per task on a clean linear trunk.
