# Git Workflow

Simple. Never breaks. Never use stash.

---

## The Only Workflow

### Starting new work

```sh
git checkout main
git pull origin main
git checkout -b <feature-slug>
```

Start every piece of work from a clean, up-to-date main. Always.

---

### During work

Commit constantly. Small commits. After every meaningful unit of work.

```sh
git add <files>
git commit -m "short imperative description"
```

Do not let work pile up uncommitted. Uncommitted work is work that can be lost or conflicted.

---

### Keeping a branch up to date with main

```sh
git fetch origin
git rebase origin/main
```

Rebase puts your commits on top of the latest main. Linear history. No merge commits. No conflicts from diverged branches sitting too long.

If there are conflicts during rebase:
1. Fix the conflict in the file
2. `git add <file>`
3. `git rebase --continue`

---

### Throwing away a branch and starting clean

```sh
git checkout main
git pull origin main
git branch -D <old-branch>
git checkout -b <new-branch>
```

If a branch is a mess — just delete it and start from main. It's fast. It's clean. It's always the right move when things go sideways.

If you want to reset an existing branch to match main exactly:

```sh
git fetch origin
git reset --hard origin/main
```

This wipes all local changes on the current branch and makes it identical to origin/main. Only do this when you mean to throw everything away.

---

### Shipping: squash and merge

```sh
# On the feature branch — squash all iteration commits into one
git reset $(git merge-base HEAD origin/main)
git add <files>
git commit -m "<feature-slug>: description of what shipped"

# Rebase onto main and fast-forward merge
git fetch origin
git rebase origin/main
git checkout main
git merge --ff-only <feature-slug>
git push origin main

# Cleanup
git branch -D <feature-slug>
```

One commit per feature on main. Clean linear history.

---

## Rules

| Rule | Why |
|---|---|
| Never `git stash` / `git stash pop` | Stash pop creates merge conflicts. Merge conflicts resolved by hand introduce bugs. Just commit instead. |
| Never edit conflict markers by hand across multiple files | Use `git checkout <sha> -- <file>` to restore the known-good version from history. |
| Never revert with `git stash` | Use `git checkout -- <file>` to discard changes to a single file, or `git reset --hard` to discard everything. |
| Always rebase, never merge | `git merge` creates merge commits that pollute history. `git rebase` keeps it linear. |
| Commit before switching context | If you need to move to different work, commit what you have (even as WIP). Never leave uncommitted changes when switching branches. |

---

## When things go wrong

### "I have uncommitted changes and need to switch branches"
Commit them. Even a WIP commit.
```sh
git add -A
git commit -m "wip: <description>"
git checkout <other-branch>
```

### "I committed to the wrong branch"
```sh
# Get the commit SHA
git log --oneline -5

# Go to the right branch and cherry-pick it
git checkout <correct-branch>
git cherry-pick <sha>

# Go back and remove it from the wrong branch
git checkout <wrong-branch>
git reset --hard HEAD~1
```

### "A file looks wrong after a conflict resolution"
Don't edit it by hand. Find the commit where it was correct:
```sh
git log --oneline board/src/components/SomeFile.tsx
git checkout <sha> -- board/src/components/SomeFile.tsx
git commit -m "fix: restore SomeFile from correct version"
```

### "The branch is a total mess"
```sh
git checkout main
git pull origin main
git branch -D <messy-branch>
git checkout -b <fresh-branch>
```

Start over. It takes 10 seconds.

---

## What never to do

- `git stash` / `git stash pop` — banned
- Resolving multi-file merge conflicts by hand across a large codebase — use `git checkout <sha> -- <file>` instead
- Committing directly to main — always use a branch
- Letting a branch diverge from main for days — rebase daily
- `git push --force` on main — never
