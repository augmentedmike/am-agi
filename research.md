# Research

## Problem

When a user creates a card without selecting a priority, the `NewCardForm` defaults to `'AI'`
priority. But `'AI'` is not a valid DB value — `NewCardForm.tsx:58` silently drops it:

```ts
if (priority !== 'AI') body.priority = priority;
```

So `'AI'` cards get stored as `'normal'` (the DB default). The agent loop has no way to
distinguish "user explicitly picked normal" vs "user wanted AI to decide". No instruction
is ever injected telling the backlog agent to pick a real priority.

## Relevant Files

### Storage
- `apps/board/src/db/schema.ts:4` — `CardPriority` type; DB enum only has `critical | high | normal | low`
- `apps/board/src/db/migrations.ts:10` — No enum check, just `TEXT NOT NULL DEFAULT 'normal'` — SQLite accepts any text value, so no migration needed

### API
- `apps/board/src/app/api/cards/schema.ts:8-11` — `createSchema` rejects 'AI' (not in enum)
- `apps/board/src/app/api/cards/[id]/schema.ts:5` — `patchSchema` priority enum (stays 4-value — agents set real priority)

### UI
- `apps/board/src/components/NewCardForm.tsx:23` — Default state is `'AI'`
- `apps/board/src/components/NewCardForm.tsx:58` — **Bug**: silently omits priority when 'AI', card stored as 'normal'

### Dispatcher / Agent Loop
- `scripts/dispatcher.ts:102` — `Priority` type lacks 'AI'
- `scripts/dispatcher.ts:119` — `PRIORITY_ORDER` lacks 'AI' (treat as normal rank)
- `scripts/dispatcher.ts:156-167` — `writeWorkMd` constructs work.md; **needs to inject AI instruction**
- `apps/board/src/worker/prompts.ts:9-41` — Canonical `BACKLOG_PROMPT` (inlined by dispatcher — both must stay in sync)

## Fix Strategy

1. Add `'AI'` to `CardPriority` in `schema.ts` and its DB enum
2. Add `'AI'` to `createSchema` priority in `apps/board/src/app/api/cards/schema.ts`
3. Fix `NewCardForm.tsx:58` — always send the priority field (including 'AI')
4. In `dispatcher.ts` `writeWorkMd`: when `card.priority === 'AI'`, append an extra paragraph telling the backlog agent to run `board update <id> --priority <value>` as its first step
5. Update `Priority` type and `PRIORITY_ORDER` / `priorityRank` in `dispatcher.ts` to handle 'AI' (rank same as normal)
6. Mirror the injection logic in canonical `BACKLOG_PROMPT` in `prompts.ts` (add a note that when Priority is AI, the first action is to set it)
