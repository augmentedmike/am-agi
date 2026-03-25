# Research: Drag-and-Drop Image Attachments

## Task
Add drag-and-drop image upload to the card detail panel. Images dropped onto the panel are uploaded and saved as card attachments.

## Relevant Files

### Frontend
- `apps/board/src/components/CardPanel.tsx:1-84` — Card detail panel; the drop target. Shows attachment list (lines 17-23) but has no upload UI or drop handling.
- `apps/board/src/components/BoardClient.tsx:11-21` — Card type includes `attachments: Attachment[]`. SSE handles `card_created` and `card_moved`; needs `card_updated` for live attachment refresh.

### API Routes
- `apps/board/src/app/api/cards/[id]/route.ts:1-30` — PATCH endpoint accepts `{ attachment: { path, name } }` to add attachments. Does NOT currently broadcast after update.
- `apps/board/src/app/api/cards/[id]/schema.ts:1-11` — Patch schema: `attachment` (object `{ path, name }`) and `attachments` (string array).
- No upload endpoint exists — need `apps/board/src/app/api/cards/[id]/upload/route.ts`.

### Database
- `apps/board/src/db/cards.ts:56-83` — `updateCard()` merges attachments, deduplicates by path. Accepts `attachment: { path, name }` for single file.
- `apps/board/src/db/schema.ts:14` — `attachments` is JSON column: `{ path: string; name: string }[]`.

### Real-time
- `apps/board/src/lib/ws-store.ts:1-18` — `broadcast(data)` sends events to all SSE clients.
- `apps/board/src/app/api/cards/[id]/route.ts` — PATCH does NOT broadcast on update (unlike move/route.ts which does). Need to add broadcast on attachment changes.

## Design

### File Storage
Store uploaded images in `public/uploads/` — Next.js serves `public/` as static files at `/uploads/`. Filename: `{cardId}-{timestamp}-{originalName}` to prevent collisions.

### Upload Endpoint
`POST /api/cards/[id]/upload` — accepts `multipart/form-data` with `file` field. Writes file to `public/uploads/`, calls `updateCard()` with `{ attachment: { path, name } }`, broadcasts `card_updated`, returns updated card JSON.

### Drop Handler in CardPanel
Add `onDragOver` + `onDrop` event handlers to the panel container. On drop, iterate `event.dataTransfer.files`, filter to `image/*`, POST each to upload endpoint via FormData. Show visual drag-over state (e.g. border highlight) while dragging.

### SSE event
Broadcast `{ type: 'card_updated', card }` from upload route. `BoardClient.tsx` listens and updates card in local state so attachments appear immediately.

## Constraints
- Next.js App Router API routes use Web APIs (`Request`/`Response`). Use `request.formData()` for multipart.
- `fs` available server-side; use `fs/promises.writeFile` to persist uploads.
- `public/uploads/` directory must exist at startup; create with `mkdirSync` if absent.
- Filter non-image drops client-side (`file.type.startsWith('image/')`) before uploading.
