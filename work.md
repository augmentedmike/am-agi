# Step 10: Dispatcher and Polling

Two things that make the board come alive:

1. **Dispatcher** — watches the board, picks up cards, runs AM with the right column prompt per state
2. **Board polling** — UI refetches cards every 5 seconds so moves are always visible

Once these are in place, a card on the board drives all work automatically. The first card to go through will implement the new card panel UI itself.

---

## Prompt

```
Read steps/10.md, apps/board/src/worker/prompts.ts, CLAUDE.md, and docs/TOOLS.md.

Do two things. Commit after each.

**1. Build `bin/dispatcher`**

A Bun script (`#!/usr/bin/env bun`) that watches the board and runs AM iterations on active cards.

- Runs a loop every 5 seconds
- Each cycle: GET /api/cards, filter to backlog/in-progress/in-review, pick highest-priority card per state
- For each card, check if worktree `../am-<cardId>` exists
- If not: `git worktree add ../am-<cardId> -b <cardId>`
- Write `work.md` to the worktree:

```
# Card: <title> (<id>)
State: <state>
Priority: <priority>

## Instructions
<column prompt for current state>
```

- Column prompts from `apps/board/src/worker/prompts.ts`:
  - backlog → BACKLOG_PROMPT
  - in-progress → IN_PROGRESS_PROMPT
  - in-review → IN_REVIEW_PROMPT
- Call `runIteration(worktreeDir)` from `agent/src/loop/index.ts`
- Log: `[dispatch] <cardId> <state>`
- On error: log and continue, never crash
- AM uses `board move <id> <state>` to transition — dispatcher never touches card state directly

**2. Add polling to the board UI**

In `apps/board/src/components/BoardClient.tsx`, add a `setInterval` that fetches `/api/cards` every 5 seconds and updates cards state. Keep the existing SSE — polling is the fallback.

**3. Create the card**

After building and committing, create the card that will be worked through the board:

```sh
board create --title "New card panel: [new card] button on top bar, slide-down panel, auto-resize textarea, pink accent" --priority high
```

Definition of done:
- `bin/dispatcher` exists and runs
- Board UI polls every 5 seconds
- Card created in backlog for the new card panel work
- `bun test` passes
```