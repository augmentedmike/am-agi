# Research: Text File Viewer for Slide-Out

## Task classification
CODE TASK — adds inline text file viewing to the CardPanel attachment section.

## Codebase findings

### Primary file to change
`board/src/components/CardPanel.tsx:568-606` — the Attachments section currently shows:
- Images inline with `<img>` (line 575 match on `.png|jpe?g|gif|webp|svg|avif`)
- Non-image files as plain `<a>` links (lines 584-593)
- A delete button per attachment (lines 594-601)

### Context
- `ReactMarkdown` is already imported (line 4) and used in the Agent Work panel (line 656)
- Attachments are typed as `{ path: string; name: string }[]` on the Card object
- Files are served statically from Next.js `public/uploads/` — can `fetch(att.path)` directly in the browser with no API change needed
- The panel is a right-side slide-out (sm:max-w-xl) with dark zinc-900 background
- Existing styling patterns: `prose prose-invert prose-sm` for markdown, `font-mono text-xs` for code, `bg-zinc-800 rounded` for containers

### Text file extensions to support
`.txt`, `.md`, `.log`, `.json`, `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.html`, `.yaml`, `.yml`, `.sh`, `.bash`, `.toml`, `.env`, `.csv`, `.xml`, `.sql`

### UX pattern
- Non-image, non-text files: keep as plain link (e.g. `.pdf`, `.zip`, `.docx`)
- Text files: show filename as a clickable expand/collapse toggle
- Expanded: fetch content, display in a scrollable box (max-h ~240px)
  - `.md` files → ReactMarkdown with prose styling
  - All other text → `<pre>` with monospaced text, horizontal scroll
- Loading state while fetching
- Error state on fetch failure

### No new API route needed
Browser can fetch `/uploads/filename` directly since Next.js serves `public/` as static assets.

## Related files (read-only, no changes needed)
- `board/src/components/BoardClient.tsx` — card type definition referenced by CardPanel
- `board/src/components/ConfirmDialog.tsx` — existing dialog pattern
- `board/src/app/api/cards/[id]/upload/route.ts` — stores files in `public/uploads/`, serves at `/uploads/{id}-{timestamp}-{safeName}`
