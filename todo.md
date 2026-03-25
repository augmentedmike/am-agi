# Todo

## Implementation
- [x] In `apps/board/src/components/BoardClient.tsx:92`, change `bg-violet-600 hover:bg-violet-500` to `bg-pink-500 hover:bg-pink-400` on the "+ New" button
- [x] In `apps/board/src/components/NewCardForm.tsx:124`, change `bg-violet-600 hover:bg-violet-500` to `bg-pink-500 hover:bg-pink-400` on the submit button
- [x] In `apps/board/src/components/NewCardForm.tsx:90`, change `focus:ring-violet-500` to `focus:ring-pink-500` on the title input

## Verification
- [x] "+ New" button renders pink (not purple) in the board header
- [x] NewCardForm submit button renders pink (not purple)
- [x] Title input focus ring is pink
- [x] Shipped column expand (`›`) and collapse (`‹`) icons are still pink — no regression
- [x] AI priority tag in NewCardForm is still violet (intentional)
