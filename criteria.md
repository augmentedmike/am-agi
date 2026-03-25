# Acceptance Criteria

1. When a card is created with `'AI'` priority via the UI (`NewCardForm`), the stored card has `priority: 'AI'` (not `'normal'`).
2. The `createSchema` in `apps/board/src/app/api/cards/schema.ts` accepts `'AI'` as a valid priority value.
3. `CardPriority` in `apps/board/src/db/schema.ts` includes `'AI'`.
4. `NewCardForm.tsx` always sends the `priority` field to the API, including when it is `'AI'`.
5. The dispatcher's `writeWorkMd` function injects an instruction block when `card.priority === 'AI'`, telling the backlog agent to run `board update <id> --priority <critical|high|normal|low>`.
6. The dispatcher's `Priority` type includes `'AI'` and `priorityRank` handles it (returns same rank as `'normal'` so 'AI' cards are processed in normal slot).
7. The canonical `BACKLOG_PROMPT` in `apps/board/src/worker/prompts.ts` reflects the same AI-priority instruction logic (kept in sync with dispatcher).
8. The `patchSchema` in `apps/board/src/app/api/cards/[id]/schema.ts` does NOT accept `'AI'` — agents must set a real priority.
9. The gate's `fileAttached` function in `gates.ts` prefers paths that exist on disk when multiple attachment paths match the same filename — `existsSync(p)` is checked before returning the first match.

- Card created with AI priority stores priority:'AI' in the DB (not 'normal')
- createSchema accepts 'AI' as a valid priority value
- CardPriority type includes 'AI'
- NewCardForm always sends the priority field (including 'AI')
- writeWorkMd injects AI instruction block when card.priority === 'AI'
- priorityRank handles 'AI' (same rank as 'normal')
- BACKLOG_PROMPT updated with AI priority selection step
- patchSchema does NOT accept 'AI' — agents must set a real priority
- fileAttached prefers existing paths when multiple attachment paths match
