# Acceptance Criteria

1. A search icon button is visible in the board top bar (between the active indicator and the `+ New` button).
2. Clicking the search button opens the `SearchPanel` slide-out panel.
3. Typing in the search input filters cards by title (case-insensitive).
4. Clicking a search result closes the `SearchPanel` and opens the `CardPanel` for that card.
5. Pressing Escape while the search panel is open closes it.
6. The `SearchPanel` is imported and rendered inside `BoardClient.tsx`.
7. No existing functionality (new card form, card panel, real-time updates) is broken.
