# Acceptance Criteria

- The `shipped → in-progress` transition is accepted by the gate (`checkGate` in `gates.ts`) and does not return an error.
- The `board move <id> in-progress` CLI command succeeds when the card is in `shipped` state.
- The move API (`POST /api/cards/[id]/move`) accepts an optional `note` string in the request body.
- When a `note` is provided with the move, it is appended to the card's `workLog` with a timestamp.
- A "Reopen" button is visible in the CardPanel only when `card.state === 'shipped'`.
- Clicking the Reopen button opens a reopen dialog/form with a required note textarea and an optional screenshot attachment area.
- Submitting the reopen form without a note shows a validation error and does not proceed.
- Submitting with a note POSTs to the move endpoint with `{ state: 'in-progress', note }` and the card transitions to `in-progress`.
- After a successful reopen, the card disappears from the Shipped column and appears in the In Progress column without a full page reload (via SSE `card_moved`).
- The reopen note appears in the card's workLog, visible in the CardPanel.
- Screenshots attached during the reopen form are uploaded via the existing upload endpoint before the move is submitted.
- Uploaded screenshots appear in the card's `attachments` list after the reopen.
- If the move request fails (network/server error), an error message is shown in the dialog and the card remains in `shipped` state.
- The reopen dialog can be dismissed/cancelled without making any changes to the card.
