# Todo: Ship Card Flip Celebration

## Research & Setup
- [x] Read CardTile.tsx, BoardClient.tsx, CardColumn.tsx
- [x] Write research.md
- [x] Write criteria.md

## Implementation
- [x] Add ship meme image to `apps/board/public/ship-meme.gif`
- [x] Add CSS 3D flip styles to `apps/board/src/app/globals.css` (perspective, preserve-3d, backface-visibility, .card-flip-inner, .card-flip-front, .card-flip-back)
- [x] Add `celebratingIds` state (Set<string>) to `BoardClient.tsx`
- [x] In `BoardClient.tsx` WebSocket handler, detect `card_moved` events where new state is `shipped`, add card ID to `celebratingIds`, schedule removal after ~4.5s
- [x] Pass `celebratingIds` prop through `CardColumn.tsx` to `CardTile.tsx`
- [x] Rewrite `CardTile.tsx` to use 3D flip wrapper (front + back faces)
  - Front face: existing card content + checkmark icon when `state === 'shipped'`
  - Back face: ship meme image
  - Apply flip class when `celebrating === true`
- [x] Verify checkmark/shipped badge shows on front after animation

## Verification
- [x] Run `bun run dev` and manually move a test card to shipped — confirm flip animation plays
- [x] Confirm meme image appears on back during 3-second window
- [x] Confirm card flips back to front with checkmark after 3 seconds
- [x] Confirm non-shipped cards are unaffected
- [x] Confirm clicking a celebrating card still opens card panel
