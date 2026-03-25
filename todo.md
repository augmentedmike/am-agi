# Todo

## Implementation
- [x] Add `shipped → in-progress` transition to `apps/board/src/worker/gates.ts` (always allowed, no gate)
- [x] Fix `fileAttached` in `gates.ts` to prefer absolute paths over relative ones
- [x] Add optional `note` field to `apps/board/src/app/api/cards/[id]/move/schema.ts`
- [x] Update `apps/board/src/app/api/cards/[id]/move/route.ts` to read `note` and append to workLog via `updateCard` after move
- [x] Add "Reopen" button to `apps/board/src/components/CardPanel.tsx` (visible only when `card.state === 'shipped'`)
- [x] Add reopen modal/form in CardPanel: required note textarea, optional screenshot drag-and-drop, submit/cancel buttons
- [x] Implement reopen submit handler: upload screenshots (reuse existing upload logic), then POST move with note, close dialog on success
- [x] Show validation error if note is empty on submit
- [x] Show error message if move request fails

## Verification
- [x] `board move <id> in-progress` succeeds when card is in `shipped` state
- [x] Move API rejects `shipped → in-progress` gate without returning a gate error (gate passes)
- [x] Move API with `note` appends entry to workLog
- [x] Reopen button visible only for shipped cards
- [x] Reopen button not visible for backlog/in-progress/in-review cards
- [x] Clicking Reopen opens dialog; Cancel closes it without changes
- [x] Submitting without note shows validation error
- [x] Submitting with note: card moves to in-progress, disappears from Shipped column (SSE)
- [x] Reopen note appears in workLog in CardPanel
- [x] Screenshots attached in dialog appear in attachments after reopen
- [x] Move failure shows error message in dialog
