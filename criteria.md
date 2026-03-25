# Acceptance Criteria: Ship Card Flip Celebration

1. When a card's state transitions to `shipped` (detected via WebSocket `card_moved` event in `BoardClient.tsx`), the corresponding `CardTile` begins a CSS 3D flip animation on the horizontal axis (rotateX) within 100ms of the event.
2. The flip-to-back animation completes in ≤ 0.7 seconds (CSS transition).
3. The back face of the flipped card shows a ship meme image that covers the full card area.
4. The meme image file exists at `apps/board/public/ship-meme.gif` (or `.jpg`/`.png`) and loads without a 404.
5. After 3 seconds of showing the meme, the card automatically flips back to the front (rotateX back to 0°).
6. The flip-back animation completes in ≤ 0.7 seconds.
7. After the flip-back animation completes, the front face of the card displays a checkmark (✓) icon or "shipped" badge in place of the active-ping indicator area.
8. The checkmark/shipped icon persists on the card after the animation — any card with `state === 'shipped'` shows it.
9. Cards in states other than `shipped` are not affected by the animation (no flip, no meme, no checkmark).
10. The flip animation does not block the `onCardClick` handler — clicking a celebrating card still opens the card panel.
11. `CardColumn.tsx` correctly forwards the `celebratingIds` prop to `CardTile` for both the regular and ShippedColumn sub-components.
12. The CSS for the 3D flip (perspective, preserve-3d, backface-visibility) is present in `globals.css` or inline styles, and the flip renders correctly in Chrome/Safari/Firefox (no flat/broken appearance).
