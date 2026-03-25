# Research: New Card Rollout Form — Priority Tags

## Task Summary
Add a new-card creation form to the board UI. The form must include:
- A title input
- Priority selection as exclusive tags (only one selectable at a time)
- An "AI" tag that is auto-selected by default (before any of the priority levels)

## Relevant Files

### API
- `apps/board/src/app/api/cards/schema.ts:8-12` — POST /api/cards accepts `{ title, priority?, workDir? }`
- `apps/board/src/app/api/cards/route.ts` — POST handler
- Priority enum: `'critical' | 'high' | 'normal' | 'low'` (default: `'normal'`)

### UI Components
- `apps/board/src/components/BoardClient.tsx:69-99` — Main board layout; header + columns. **New card button goes in the header.**
- `apps/board/src/components/CardTile.tsx:3-8` — Priority badge styles (reuse for tags in form)
- `apps/board/src/components/CardColumn.tsx` — Column layout
- `apps/board/src/components/CardPanel.tsx` — Side panel

### State / Types
- `apps/board/src/components/BoardClient.tsx:10-20` — `Card` type definition
- `BoardClient` already handles `card_created` SSE events, so new cards appear instantly

## Design Decision: "AI" Tag
The "AI" tag is the first and default-selected option. When selected, priority is omitted from the POST body (server defaults to `'normal'`). The intent is to let the AI agent choose/inherit the priority rather than a human picking one manually.

When a concrete priority (`critical`, `high`, `normal`, `low`) is selected, that value is sent in the POST body.

## Tag Style Reference (from CardTile.tsx)
```
critical: bg-red-500/20 text-red-300 border border-red-500/30
high:     bg-orange-500/20 text-orange-300 border border-orange-500/30
normal:   bg-zinc-500/20 text-zinc-300 border border-zinc-500/30
low:      bg-blue-500/20 text-blue-300 border border-blue-500/30
AI:       bg-violet-500/20 text-violet-300 border border-violet-500/30  (new)
```

## Implementation Plan
1. Create `apps/board/src/components/NewCardForm.tsx` — inline form with title input + priority tags + submit
2. Add a "+ New" button to the header in `BoardClient.tsx` that toggles the form
3. On submit: `POST /api/cards`, reset form, close

No new API changes needed — existing endpoint supports everything required.
