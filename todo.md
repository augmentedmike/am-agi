# Todo: Text File Viewer for Slide-Out

- [x] Add `isTextFile(path)` helper function that returns true for known text extensions
- [x] Add `TextFileViewer` sub-component (or inline logic) that fetches and renders file content
- [x] Add per-attachment state: `expandedAtts` (Set of paths), `attContents` (Map path→string), `attLoading` (Set), `attErrors` (Map path→string)
- [x] Reset attachment viewer state when `card?.id` changes
- [x] Update the attachments rendering block in CardPanel to:
  - [x] Show text files with a toggle button (▶/▼) and filename
  - [x] On expand: fetch content, show loading spinner, then render content
  - [x] On collapse: hide content (keep cached in state, no re-fetch)
  - [x] For `.md`: render with ReactMarkdown
  - [x] For other text: render in `<pre>` block
  - [x] Show error message if fetch fails
- [x] Keep image rendering unchanged
- [x] Keep non-text/non-image link rendering unchanged
- [x] Keep delete button working for all attachment types
- [x] Verify no TypeScript errors
- [x] Verify criteria 1-12 pass
