# Git Workflow

Simple. Never breaks. Never use stash.

---

## Branch Model

| Branch | Purpose |
|---|---|
| `main` | Stable releases only. Never commit directly. Only merge from `dev` when verified. |
| `dev` | Integration branch. All feature branches merge here. board-deploy deploys from here. |
| `<feature-slug>` | Short-lived feature branches off `dev`. |

---

## The Only Workflow

### Starting new work

```sh
git checkout dev
git pull origin dev
git checkout -b <feature-slug>
```

Start every piece of work from a clean, up-to-date `dev`. Always.

---

### During work

Commit constantly. Small commits. After every meaningful unit of work.

```sh
git add <files>
git commit -m "short imperative description"
```

Do not let work pile up uncommitted. Uncommitted work is work that can be lost or conflicted.

---

### Keeping a branch up to date with dev

```sh
git fetch origin
git rebase origin/dev
```

Rebase puts your commits on top of the latest dev. Linear history. No merge commits.

If there are conflicts during rebase:
1. Fix the conflict in the file
2. `git add <file>`
3. `git rebase --continue`

---

### Merging a feature into dev

```sh
# Squash all iteration commits into one
git reset $(git merge-base HEAD origin/dev)
git add <files>
git commit -m "<feature-slug>: description of what shipped"

# Rebase and fast-forward merge into dev
git fetch origin
git rebase origin/dev
git checkout dev
git merge --ff-only <feature-slug>
git push origin dev

# Cleanup
git branch -D <feature-slug>
```

---

### Promoting dev → main (stable release)

Only when dev is verified stable and prod has been running cleanly.

```sh
git checkout main
git merge --ff-only dev
git push origin main
```

Never force-push main. Never commit directly to main.

---

### Throwing away a branch and starting clean

```sh
git checkout dev
git pull origin dev
git branch -D <old-branch>
git checkout -b <new-branch>
```

---

## Rules

| Rule | Why |
|---|---|
| Never `git stash` / `git stash pop` | Stash pop creates merge conflicts. Merge conflicts resolved by hand introduce bugs. Just commit instead. |
| Never commit directly to `main` | main is for stable releases merged from dev only. |
| Never edit conflict markers by hand across multiple files | Use `git checkout <sha> -- <file>` to restore the known-good version from history. |
| Always rebase, never merge | `git merge` creates merge commits that pollute history. `git rebase` keeps it linear. |
| Commit before switching context | If you need to move to different work, commit what you have (even as WIP). |

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
git log --oneline -5
git checkout <correct-branch>
git cherry-pick <sha>
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
git checkout dev
git pull origin dev
git branch -D <messy-branch>
git checkout -b <fresh-branch>
```

Start over. It takes 10 seconds.

---

## What never to do

- `git stash` / `git stash pop` — banned
- Committing directly to `main` — always go through dev
- Resolving multi-file merge conflicts by hand — use `git checkout <sha> -- <file>`
- `git push --force` on main or dev — never
- Letting a branch diverge from dev for days — rebase daily
