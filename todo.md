# Todo

## Implementation
- [x] Create `apps/board/public/uploads/` directory (add `.gitkeep`)
- [x] Create `apps/board/src/app/api/cards/[id]/upload/route.ts` — POST handler: parse `multipart/form-data`, write image to `public/uploads/{cardId}-{ts}-{name}`, call `updateCard()` with attachment, broadcast `card_updated`, return updated card
- [x] Add `card_updated` event handling in `BoardClient.tsx` SSE listener to refresh card in state
- [x] Update `CardPanel.tsx` with drag-and-drop handlers: `onDragOver` (prevent default + set drag state), `onDrop` (filter images, POST to upload endpoint), visual drag-over indicator, uploading state, error display
- [x] Render attached images as clickable links or inline `<img>` previews in CardPanel

## Verification
- [x] Drag image over CardPanel — drag-over indicator appears (border/overlay visible)
- [x] Drop image onto panel — file uploaded, attachment appears in panel without reload (SSE `card_updated` updates state)
- [x] Drop non-image (e.g. `.txt`) — error shown, no upload occurs
- [x] Drop multiple images at once — all uploaded and listed as attachments
- [x] Upload in progress — loading state shown on panel
- [x] Upload fails (simulate 500) — error message displayed, attachment not added
- [x] `GET /api/cards/{id}` after drop — `attachments` array contains uploaded file with correct path and name
- [x] Uploaded file exists at `public/uploads/{cardId}-{ts}-{name}` on server filesystem
