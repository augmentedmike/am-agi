# Acceptance Criteria

- Dragging an image file over the card detail panel (CardPanel) shows a visible drag-over indicator (e.g. highlighted border or overlay).
- Dropping one or more image files onto the panel uploads each file to the server.
- Only image files (`image/*` MIME type) are accepted; dropping a non-image file shows an error message and does not upload.
- Uploaded images are stored in `public/uploads/` with a collision-resistant filename (`{cardId}-{timestamp}-{originalName}`).
- A `POST /api/cards/[id]/upload` endpoint accepts `multipart/form-data` with a `file` field and returns the updated card JSON.
- After a successful upload, the attachment is recorded on the card (visible in `attachments` array via `GET /api/cards/[id]`).
- A `card_updated` SSE event is broadcast after each successful upload.
- The newly attached image appears in the CardPanel attachment list without a full page reload (via SSE `card_updated`).
- Attached images render as clickable links (or inline previews) in the CardPanel.
- Multiple images dropped at once are each uploaded and attached individually.
- While an upload is in progress, the panel shows a loading/uploading state.
- If an upload fails (network error, server error), an error message is shown and no partial attachment is recorded.
