# Research: Ship Card Flip Celebration Animation

## Goal
When a card transitions to the `shipped` state, animate the `CardTile` component with a CSS 3D flip on the horizontal axis (rotateX). The back shows a ship meme image for 3 seconds, then it flips back to the front which displays a "shipped" checkmark icon permanently.

## Key Files

### CardTile component
`apps/board/src/components/CardTile.tsx:11-65`
- Renders individual kanban cards
- Props: `card: Card`, `onCardClick: (card: Card) => void`
- Has no animation today beyond hover lift and the active ping indicator
- This is where the flip animation and both faces of the card will live

### BoardClient (state owner)
`apps/board/src/components/BoardClient.tsx:28-173`
- Owns `cards` state (line 29)
- Receives `card_moved` WebSocket events (lines 51-55) — this is where transitions to `shipped` are detected
- Passes `cards` → `CardColumn` → `CardTile`; adding a `celebratingIds: Set<string>` state here lets us track which cards are currently mid-flip

### CardColumn (pass-through)
`apps/board/src/components/CardColumn.tsx:147-211`
- Passes card + `onCardClick` to `CardTile` (lines 175-182 approx)
- Will need to accept and forward a `celebratingIds` prop

### Global CSS
`apps/board/src/app/globals.css`
- Place for any keyframe/utility classes not expressible in Tailwind inline

## CSS 3D Flip Technique
```
perspective: 1000px on wrapper
transform-style: preserve-3d on inner element
.flipped { transform: rotateX(180deg) }
backface-visibility: hidden on both faces
back face: transform: rotateX(180deg) to start hidden
```
Tailwind 4 supports arbitrary CSS; the flip can be driven with a `data-flipped` attribute + CSS in globals.css.

## Ship Meme Image
- Add a static `ship-meme.gif` (or `.jpg`) to `apps/board/public/`
- Use a classic "it's shipping!" / SpongeBob imagination rainbow / rocket ship meme
- Reference via `/ship-meme.gif` in the component

## Animation Sequence
1. `card_moved` event arrives with `state: 'shipped'`
2. BoardClient adds card ID to `celebratingIds` Set
3. CardTile receives `celebrating: true` — starts flip to back (0.6s CSS transition)
4. Back face shows meme image (full card area)
5. After 3 seconds, flip back to front (0.6s transition)
6. After flip-back completes, remove from `celebratingIds`
7. Front face always shows checkmark icon when `card.state === 'shipped'`

## References
- MDN CSS 3D transforms: https://developer.mozilla.org/en-US/docs/Web/CSS/transform-style
- CSS backface-visibility: https://developer.mozilla.org/en-US/docs/Web/CSS/backface-visibility
- Tailwind 4 arbitrary CSS: https://tailwindcss.com/docs/adding-custom-styles
