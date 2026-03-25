# Todo

- [x] Research: identify files to change, write criteria.md + todo.md, move card to in-progress
- [x] Add `agentText` state; fetch from `/api/cards/:id/agent-message` on card open and poll every 5s
- [x] Add `bottomHeight` state initialized from `localStorage` key `card-panel-split-<cardId>`, falling back to auto-size from line count
- [x] Add `isDividerDragging` + drag refs (`startY`, `startHeight`) for the divider
- [x] Refactor panel body: replace single scrollable `div` with top panel (`flex-1 overflow-y-auto`) + divider bar + bottom panel (fixed height `overflow-y-auto`)
- [x] Implement `onMouseDown` on divider → attach `mousemove`/`mouseup` listeners on `document`
- [x] On `mouseup`, save `bottomHeight` to `localStorage` under `card-panel-split-<cardId>`
- [x] Clamp drag: min 60px, max `panelRef.current.clientHeight - 80`
- [x] Hide divider + bottom panel entirely when `agentText === null`
- [x] Add "Agent Work" section header label in bottom panel
- [x] Render agent text with `ReactMarkdown` (same as top panel prose style)
- [x] Reset agent text + bottom height state when selected card changes (card ID changes)
- [x] Verify: different cards have independent localStorage heights
- [x] Verify: auto-size formula `min(max(lineCount * 20, 80), 320)` works for empty, short, and long texts
