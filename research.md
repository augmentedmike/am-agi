# Research: Reopen Shipped Tickets

## Task Summary
Allow users to reopen a `shipped` card back to `in-progress` from the board UI, attaching a reopen note and optional screenshots.

## Current State Machine

**File:** `apps/board/src/worker/gates.ts:207-321`

Allowed transitions today:
- `backlog → in-progress` (gated)
- `in-progress → in-review` (gated)
- `in-review → shipped` (gated)
- `in-review → in-progress` (always allowed — failure recovery)

**Missing:** `shipped → in-progress` — this transition does not exist. Attempting it hits the "invalid transition" branch at line 314 and is rejected.

## Move API

**File:** `apps/board/src/app/api/cards/[id]/move/route.ts:12-27`

- Validates `state` from JSON body via schema (`apps/board/src/app/api/cards/[id]/move/schema.ts`)
- Calls `checkGate()` — rejects with 422 on failure
- Calls `moveCard()` from `apps/board/src/db/cards.ts:85-88`
- Broadcasts `card_moved` SSE event
- Returns updated card JSON

The request body currently only accepts `{ state }`. We need to add an optional `note` field so a reopen reason is appended to the workLog on move.

## Card Data Model

**File:** `apps/board/src/db/schema.ts:9-20`

```typescript
workLog: Array<{ timestamp: string; message: string }>
attachments: Array<{ path: string; name: string }>
```

Notes go in `workLog`. Screenshots go in `attachments` (uploaded via existing `/api/cards/[id]/upload` endpoint).

## DB Operations

**File:** `apps/board/src/db/cards.ts`

- `moveCard(id, state)` — updates state, sets updatedAt
- `updateCard(id, patch)` — merges patch fields (workLog, attachments, etc.)

To append a reopen note: call `updateCard` with a `workLog` entry after `moveCard`, or extend the move route to handle it inline.

## CardPanel UI

**File:** `apps/board/src/components/CardPanel.tsx`

Current panel shows: title, state badge, priority, timestamps, worklog, attachments, drag-and-drop upload (added in prior task). No state-change controls exist.

For the reopen flow we need:
1. A "Reopen" button visible only when `card.state === 'shipped'`
2. A modal/inline form with:
   - Textarea for reopen note (required)
   - Drag-and-drop + file picker for screenshot uploads (optional, reuses existing upload endpoint)
   - Submit button: uploads any screenshots first, then POSTs `{ state: 'in-progress', note }` to move endpoint

## Upload Endpoint (already exists)

**File:** `apps/board/src/app/api/cards/[id]/upload/route.ts`

Accepts `multipart/form-data` with `file` field. Saves to `public/uploads/{cardId}-{ts}-{name}`, appends to `attachments`, broadcasts `card_updated`.

## BoardClient SSE

**File:** `apps/board/src/components/BoardClient.tsx:30-49`

Listens for `card_moved` and `card_updated` events. The reopen move will trigger `card_moved`, causing the card to leave the Shipped column and appear in In Progress automatically.

## Summary of Changes

| File | Change |
|------|--------|
| `apps/board/src/worker/gates.ts` | Add `shipped → in-progress` transition (always allowed, like `in-review → in-progress`) |
| `apps/board/src/app/api/cards/[id]/move/schema.ts` | Add optional `note: string` field |
| `apps/board/src/app/api/cards/[id]/move/route.ts` | Read `note` from body; after move, append to workLog via `updateCard` |
| `apps/board/src/components/CardPanel.tsx` | Add Reopen button + modal (note textarea + screenshot upload + submit) |
