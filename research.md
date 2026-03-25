# Research: Split Panel with Draggable Divider

## Task Summary
Refactor `CardPanel` to show agent work text in a **bottom** panel, separated from the card-detail top panel by a draggable divider. The divider auto-sizes to fit agent text; if the user drags it, save the height for that card in localStorage.

## Key Files

### `apps/board/src/components/CardPanel.tsx` (L245–477)
- The slide-in right panel component
- Currently renders card metadata + attachments in a single scrollable `div`
- Does NOT fetch or display agent work text at all
- Full height, `flex-col`, header + scrollable content area

### `apps/board/src/app/api/cards/[id]/agent-message/route.ts` (L76–93)
- `GET /api/cards/:id/agent-message`
- Returns `{ text: string | null, timestamp?: string }`
- Reads the most-recently-modified `.jsonl` from `~/.claude/projects/<encoded-workDir>/`
- Extracts the last assistant text block

### `apps/board/src/components/BoardClient.tsx` (L167–170)
- Renders `<CardPanel card={selectedCard} .../>` — no changes needed here

### `apps/board/src/db/schema.ts`
- `Card` has `workDir: string | null` — if null, there is no agent data

## Design

```
┌──────────────────────────────────┐  ← CardPanel fixed right-side overlay
│  Header (Card Detail)   [✕]      │  shrink-0
├──────────────────────────────────┤
│                                  │
│   Top panel: card detail         │  flex-1, overflow-y-auto
│   (scrolls freely)               │
│                                  │
├══════════════════════════════════╡  ← draggable divider bar (8px, cursor: row-resize)
│                                  │
│   Bottom panel: agent work text  │  fixed height (px), overflow-y-auto
│   (markdown rendered)            │
│                                  │
└──────────────────────────────────┘
```

**Auto-sizing**: When no localStorage preference exists, compute an initial bottom-panel height based on agent text line count (capped between 80px and 320px). Formula: `min(max(lineCount * 20, 80), 320)`.

**Drag behavior**:
- `onMouseDown` on the divider → track `mousemove` on `document`
- Compute `deltaY` from initial mouse position
- New bottom height = `initialBottomHeight - deltaY` (dragging down shrinks bottom, up grows it)
- Clamp between 60px and (panelHeight - headerHeight - 80px)
- `onMouseUp` → stop tracking, save `bottomPanelHeight` to `localStorage` key `card-panel-split-${cardId}`

**localStorage**: Only written on drag-end; read on card-open. Key per card ID.

**Agent text polling**: Fetch on card open and poll every 5s (same cadence as board polling). Only show bottom panel if `text !== null`.

## No Backend Changes Needed
The `/api/cards/[id]/agent-message` endpoint already exists and returns what we need.
