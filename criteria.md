# Acceptance Criteria

- `apps/board/src/components/BoardClient.tsx` contains a "new card" toggle button in the header (the `+ new card` button).
- No button label in `BoardClient.tsx` contains literal bracket characters `[` or `]` in its rendered text.
- The submit button inside the new card panel displays `Create` (not `[create]`) when not in the creating state.
- The slide-down new card panel exists in `BoardClient.tsx` with a textarea and submit button.
- The polling fallback (`setInterval` every 5 seconds) is present in `BoardClient.tsx`.
- `bun run build` (or `bun test`) passes with no TypeScript errors.
