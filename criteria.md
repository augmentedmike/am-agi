# Acceptance Criteria

1. In `CardTile.tsx`, the title `<span>` has the `truncate` Tailwind class (single-line ellipsis).
2. In `CardTile.tsx`, the title `<span>` does NOT have any multi-line wrapping classes (no `line-clamp-*`, no `whitespace-normal` override).
3. In `CardTile.tsx`, the agent text `<p>` does NOT have `line-clamp-2` (message renders fully).
4. The board UI renders active cards where the title is one truncated line and the agent message is fully visible below it.
5. No other CardTile behaviour changes (priority badge, active indicator, ID display, click handler, polling).
