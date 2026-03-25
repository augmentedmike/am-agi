# Todo

## Implementation

- [x] `apps/board/src/worker/gates.ts:38-40` — fix `fileAttached` to prefer paths that exist on disk
- [x] `apps/board/src/db/schema.ts:4` — add `'AI'` to `CardPriority` type and DB enum
- [x] `apps/board/src/app/api/cards/schema.ts:10` — add `'AI'` to `createSchema` priority enum
- [x] `apps/board/src/components/NewCardForm.tsx:57-58` — always send priority in body (removed `if (priority !== 'AI')` guard)
- [x] `scripts/dispatcher.ts:102` — add `'AI'` to `Priority` type
- [x] `scripts/dispatcher.ts:119` — handle 'AI' in `priorityRank` (returns same as 'normal')
- [x] `scripts/dispatcher.ts:156-167` — update `writeWorkMd` to inject AI instruction block when `card.priority === 'AI'`
- [x] `apps/board/src/worker/prompts.ts` — update `BACKLOG_PROMPT` with step 2 for AI priority

## Verification

- [x] Card created with AI priority stores `priority: 'AI'` in the DB (not 'normal')
- [x] Card created with explicit 'normal' priority stores `priority: 'normal'`
- [x] `writeWorkMd` output for an AI-priority backlog card includes the `board update <id> --priority` instruction
- [x] `writeWorkMd` output for a non-AI-priority card does NOT include the extra instruction
- [x] `priorityRank('AI')` returns the same rank as `priorityRank('normal')` (no crash, no undefined)
- [x] `patchSchema` still rejects `priority: 'AI'` (agents must set real priority)
- [x] Gate passes for a card with absolute-path attachments (fileAttached prefers existing paths)
