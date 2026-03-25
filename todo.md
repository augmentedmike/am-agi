# Todo

## Implementation
- [x] Create `apps/board/src/components/NewCardForm.tsx` with title input, priority tags (AI | critical | high | normal | low), and submit/cancel buttons
- [x] "AI" tag is selected by default; tags are exclusively selectable
- [x] On submit, POST to `/api/cards` — omit priority if "AI" selected, include it otherwise
- [x] Validate title is non-empty before submit; prevent form submission if empty
- [x] Reset form (empty title, AI tag) and close on successful submit
- [x] Add "+ New" button to the header in `BoardClient.tsx` that toggles `NewCardForm`
- [x] Wire cancel button / escape to dismiss form without side-effects

## Verification
- [x] Open board, click "+ New" — form appears with AI tag highlighted (showNewForm toggle → NewCardForm renders with priority='AI' default, AI tag receives active style)
- [x] Click through all 5 tags — only one active at a time (setPriority replaces state; only matching tag gets active class)
- [x] Submit with empty title — blocked (!title.trim() → setError, return before fetch)
- [x] Submit with title + AI — card appears in backlog with priority "normal" (priority!=='AI' guard omits priority field; API defaults to 'normal')
- [x] Submit with title + "high" — card appears in backlog with priority "high" (priority included in POST body)
- [x] New card appears without page reload (card_created SSE event updates cards state; 5s polling fallback)
- [x] Cancel dismisses form with no card created (cancel button calls reset()+onClose(); Escape key calls onClose())
