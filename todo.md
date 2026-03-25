# Todo

## Implementation

- [x] `apps/board/src/components/CardTile.tsx:51` — make title color conditional: `text-zinc-500` when `agentText`, else `text-zinc-100`
- [x] `apps/board/src/components/CardTile.tsx:57` — make ID color conditional: `text-zinc-600` when `agentText`, else `text-zinc-500`
- [x] `apps/board/src/components/CardTile.tsx:59` — change agent text color from `text-zinc-400` to `text-zinc-100`

## Verification

- [x] With agent text present: title is dim (`text-zinc-500`), ID is dimmer (`text-zinc-600`), agent text is bright (`text-zinc-100`)
- [x] Without agent text: title is bright (`text-zinc-100`), ID is normal (`text-zinc-500`) — unchanged behavior
- [x] No other classes or structure altered
