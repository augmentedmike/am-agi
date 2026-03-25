# Acceptance Criteria

1. The `CardPanel` renders a **bottom panel** containing agent work text (fetched from `/api/cards/:id/agent-message`); the card-detail content is in the **top panel** above it.

2. When no agent work text is available (`text === null` or `workDir === null`), the bottom panel is hidden and the top panel fills the full height.

3. A **horizontal divider bar** is visible between the top and bottom panels when agent text is present; it has `cursor: row-resize` styling and is at least 6px tall for easy grabbing.

4. On first open (no localStorage entry for the card), the bottom panel height is **auto-sized** based on agent text line count — clamped between 80px and 320px.

5. Dragging the divider up/down **resizes** the top and bottom panels in real-time (no lag or jank).

6. On drag-end, the chosen split is saved to `localStorage` under the key `card-panel-split-<cardId>`.

7. On re-opening the same card, the bottom panel height is restored from `localStorage` (not auto-sized).

8. The saved height is **per card** — opening a different card does not inherit the previous card's saved height.

9. The top panel remains **independently scrollable** when its content exceeds the available height.

10. The bottom panel remains **independently scrollable** when the agent text exceeds its allocated height.

11. Agent text is **polled every 5 seconds** while the panel is open and updates live.

12. The bottom panel shows a **label/header** (e.g. "Agent Work") so the user knows what section they are looking at.
