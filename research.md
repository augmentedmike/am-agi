# Research: Remove [brackets] from new card button label

## Summary

The new card panel feature was implemented in orphaned commit `29dbda9` (not on main). It added an inline slide-down panel to `BoardClient.tsx` for creating cards. That commit has **two** button labels to inspect:

1. **Header toggle button** — `+ new card` — no brackets, already clean
2. **Submit button inside the panel** — `[create]` — **has brackets**, needs fixing

The current `main` branch does NOT have the new card panel at all. The task is therefore to:
- Port the new card panel feature from commit `29dbda9` into `apps/board/src/components/BoardClient.tsx`
- Remove the brackets from the `[create]` button label
- Preserve the polling fallback (`setInterval` every 5s) that exists in current main but not in 29dbda9

## Key files

- `apps/board/src/components/BoardClient.tsx` — the only file that needs to change (line ~150 in 29dbda9's version has `[create]`)

## Source commits

- `29dbda9` — "feat: add new card panel to board header" — most complete version of the feature
- `e3c880a` — original `[new card]` button (superseded)
- `61e1802` — separate NewCardPanel component approach (superseded by inline approach in 29dbda9)

## Bracket locations in 29dbda9

```
{creating ? 'creating…' : '[create]'}
```

This is the only bracket in the new card panel UI. The fix is to change `'[create]'` → `'Create'`.
