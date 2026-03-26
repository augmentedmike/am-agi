# Acceptance Criteria: Text File Viewer for Slide-Out

1. Text file attachments (`.txt`, `.md`, `.log`, `.json`, `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.html`, `.yaml`, `.yml`, `.sh`, `.toml`, `.csv`) display with an expand/collapse toggle in the CardPanel attachments section.

2. Clicking the toggle on a collapsed text file fetches its content and renders it inline within the CardPanel (no new tab opens for the expand action).

3. `.md` files render their content with ReactMarkdown (markdown formatting applied).

4. Non-`.md` text files render their content in a `<pre>` block with monospace font and horizontal scroll for long lines.

5. The inline viewer is scrollable and capped at a max height (≤ 240px) so it does not overflow the panel.

6. A loading indicator is shown while file content is being fetched.

7. If the fetch fails (network error or non-200 response), an error message is shown in place of the file content.

8. Non-text, non-image attachments (e.g. `.pdf`, `.zip`) continue to render as plain links unchanged.

9. Image attachments (`.png`, `.jpg`, `.gif`, `.webp`, `.svg`, `.avif`) continue to render inline as before.

10. The delete button (✕) for each attachment remains functional and visible on hover for text file attachments.

11. The viewer state (expanded/collapsed) resets when the CardPanel closes and reopens on a different card.

12. All changes are confined to `board/src/components/CardPanel.tsx` — no new files, no new API routes.
