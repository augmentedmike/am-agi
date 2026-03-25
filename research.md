# Research: Pink Accent vs Purple — "+ New" Button Regression

## Root Cause

Commit `1980f5e` (priority tag selector refactor) replaced `NewCardPanel` with `NewCardForm` and accidentally changed the "+ New" button color from the app's pink accent to violet/purple:

**Before (`61e1802`):**
```
bg-pink-500 hover:bg-pink-400 active:bg-pink-600 text-white
```

**After / current (`1980f5e`) — the regression:**
```
bg-violet-600 hover:bg-violet-500 text-white
```

The same commit introduced `NewCardForm.tsx` with a violet submit button and violet focus ring.

## The shipped expand/collapse icon is fine

The shipped column's expand/collapse icons (`CardColumn.tsx:95`, `CardColumn.tsx:132`) correctly use `text-pink-500` — no change needed there.

## Files to change

- `apps/board/src/components/BoardClient.tsx:92`
  - Change: `bg-violet-600 hover:bg-violet-500` → `bg-pink-500 hover:bg-pink-400`

- `apps/board/src/components/NewCardForm.tsx:124` (submit button)
  - Change: `bg-violet-600 hover:bg-violet-500` → `bg-pink-500 hover:bg-pink-400`

- `apps/board/src/components/NewCardForm.tsx:90` (title input focus ring)
  - Change: `focus:ring-violet-500` → `focus:ring-pink-500`

## Note on AI priority tag (NewCardForm.tsx:10)

The AI tag uses violet (`bg-violet-500/20 text-violet-300`) intentionally as a distinct visual identity — it's not an accent button, it's a tag badge. Leave it violet.

## Accent color

`apps/board/src/app/globals.css:11` — `--color-accent: var(--color-pink-500)`
