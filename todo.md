# Todo

- [x] Update `apps/board/src/components/BoardClient.tsx` to incorporate the new card panel from commit 29dbda9 (inline slide-down panel, toggle button, textarea, submit)
- [x] Fix the `[create]` button label → `Create` (remove brackets)
- [x] Ensure the polling fallback (`setInterval` 5s) is preserved from the current main version
- [x] Verify no bracket characters remain in any button label text
- [x] Run `bun test` to confirm no regressions (77 pass, 4 pre-existing failures unrelated to this change)
- [x] Commit the changes
