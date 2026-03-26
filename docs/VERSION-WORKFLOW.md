# Version-Based After-Hook Workflow

How versioned projects work in AM Board — from tagging cards to automated post-ship actions.

---

## Concepts

### Versioned Project

A project where work is organized into named version batches (e.g., `0.0.15`, `1.0.0`). Each card in the project can carry a version tag. All cards sharing a version form a **version batch** that the dispatcher prioritizes and tracks together.

### Version Tag on a Card

A free-form text field on every card (e.g., `0.0.15`, `v1`). Cards with a version tag display a violet pill badge in both the tile view and the card detail panel.

### Current Version (Project Setting)

A per-project setting (`current_version`) stored in the board's settings table. When set, the dispatcher and `board search` sort cards so that version-matching cards float to the top of each board column — above all other priorities. This keeps the active version visible and worked first.

---

## Quick Start

### 1. Tag a card with a version

```sh
# On create
board create --title "My feature" --priority high --version 0.0.15

# On an existing card
board update <card-id> --version 0.0.15
```

### 2. Set the current version for a project

```sh
board settings set current_version 0.0.15
```

Cards tagged `0.0.15` now sort to the top of every column in `board search` and the board UI.

### 3. Enable after-hooks for your project

After-hooks are configured in `ShipCardOptions` when calling `shipCard()` from `agent/src/git/commit.ts`:

```typescript
await shipCard(cardId, description, {
  bumpVersion: true,      // bump patch version in package.json
  createTag: true,        // push git tag v<version>
  createMilestone: true,  // create GitHub milestone
  githubToken: process.env.GITHUB_TOKEN,
});
```

---

## After-Hooks

Three hooks are available. They fire **after** the card is merged to main and **before** the worktree is cleaned up. They run in this fixed order:

| Order | Hook | Flag | What It Does |
|-------|------|------|-------------|
| 1 | Bump version | `bumpVersion: true` | Increments the patch version in `package.json`, commits the change, and pushes to `origin/main`. |
| 2 | Create git tag | `createTag: true` | Creates a git tag `v<new-version>` and pushes it to `origin`. |
| 3 | Create GitHub milestone | `createMilestone: true` | POSTs to the GitHub Milestones API to create a milestone named `v<new-version>`. Requires a GitHub token. |

### bumpVersion

Reads `package.json` from the repo root, increments the patch segment (`x.y.Z → x.y.Z+1`), commits the change as `chore: bump version to <new-version>`, and pushes to `origin/main`. Returns the new version string, which is passed to `createTag` and `createMilestone` if those hooks are also enabled.

If no `package.json` exists at the repo root, the hook is a no-op and returns `"0.0.0"`.

### createTag

Creates a git tag `v<version>` at the current `HEAD` of `origin/main` and pushes it. If `bumpVersion` is also enabled, the version used is the newly bumped version. Otherwise, it uses whatever version `bumpVersion` returned (default `"0.0.0"`).

**Note:** Enable `bumpVersion` alongside `createTag` for meaningful tag names. Without `bumpVersion`, the tag will be `v0.0.0`.

### createMilestone

Posts to `https://api.github.com/repos/<owner>/<repo>/milestones` with the title `v<version>`. Requires:

- A GitHub token set via `githubToken` option **or** `GITHUB_TOKEN` environment variable
- The project's `origin` remote must be a GitHub URL (HTTPS or SSH)

If the token is missing or the remote is not GitHub, the hook is silently skipped (no-op).

---

## Full Ship Sequence

When a card ships, `shipCard()` executes these steps in order:

```
1.  stepSquash          — collapse all iter commits into one atomic commit
2.  stepFetch           — git fetch origin
3.  stepRebase          — git rebase origin/main
4.  stepCheckoutMain    — git checkout main
5.  stepMerge           — git merge --ff-only <cardId>
6.  stepRestartBoard    — restart Next.js dev server (detached)
7.  stepPush            — git push origin main
---  after-hooks fire here ---
8.  [bumpVersion]       → stepBumpVersion  → commit + push new patch version
9.  [createTag]         → stepCreateTag    → create + push v<version> tag
10. [createMilestone]   → stepCreateMilestone → POST to GitHub milestones API
---  cleanup ---
11. stepWorktreeRemove  — git worktree remove ../am-<cardId>
12. stepBranchDelete    — git branch -d <cardId>
```

Any step that fails throws an `Error("<step-name>: <stderr>")`. The sequence halts on the first failure.

---

## Version-Based Sort Order

When `current_version` is set, `board search` and the board UI apply a two-level sort to non-shipped columns:

1. **Tier 1 — version match:** Cards whose `version` equals `current_version` rank above all others, regardless of priority.
2. **Tier 2 — priority:** Within each tier, cards sort by priority: `AI → critical → high → normal → low`.

When `current_version` is empty or unset, the sort falls back to priority-only (no regression).

---

## ShipCardOptions Reference

```typescript
// agent/src/git/commit.ts
interface ShipCardOptions {
  cwd?:             string;    // worktree path (defaults to process.cwd())
  repoRoot?:        string;    // repo root for checkout/push (defaults to cwd)
  execFn?:          ExecFn;    // override exec for testing
  restartBoardFn?:  () => void; // override board restart for testing
  bumpVersion?:     boolean;   // bump patch version in package.json
  createTag?:       boolean;   // create git tag v<version>
  createMilestone?: boolean;   // create GitHub milestone
  githubToken?:     string;    // GitHub PAT (falls back to GITHUB_TOKEN env)
}
```

---

## See Also

- `agent/src/git/commit.ts` — implementation of `shipCard` and all hook steps
- `docs/AGENT-LOOP.MD` — overall agent loop and ship script
- `docs/KANBAN.MD` — state machine and gate rules
- https://semver.org/ — semantic versioning spec
- https://docs.github.com/en/rest/issues/milestones — GitHub Milestones API
