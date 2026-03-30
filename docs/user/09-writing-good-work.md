# Writing Good Work

A card has three files. Each has a strict role.

| File | Role | Who writes it |
|------|------|---------------|
| `work.md` | What to build — context and intent | Human |
| `criteria.md` | Binary acceptance tests | Agent (first iteration) |
| `todo.md` | Step checklist | Agent (each iteration) |

---

## Example `work.md`

```markdown
# Add dark mode toggle

The board UI should support a dark/light mode toggle. The preference
should persist across page reloads (localStorage).

The toggle should appear in the top-right corner of the board header.
Use Tailwind's `dark:` variant classes — no custom CSS.

## Out of scope
- System preference detection (prefers-color-scheme)
- Per-card theme overrides
```

**Rules for good `work.md`:**
- State intent, not implementation steps
- Include explicit out-of-scope items to prevent scope creep
- Keep it under one screen — agents don't read past the fold reliably

---

## Example `criteria.md`

```markdown
# Acceptance Criteria: Dark Mode Toggle

1. A toggle button exists in the board header (top-right).
2. Clicking the toggle switches all Tailwind `dark:` classes on `<html>`.
3. The selected mode is saved to `localStorage` key `am-theme`.
4. On page reload, the saved preference is applied before first paint (no flash).
5. All existing Playwright tests still pass.
6. No custom CSS added — only Tailwind utility classes used.
```

**Rules for good `criteria.md`:**
- Numbered list only — no prose, no sections
- Each item must be binary: pass or fail, no partial credit
- Every item must be directly verifiable (run a test, check a file, open a URL)

---

## Example `todo.md`

```markdown
# Todo: Dark Mode Toggle

- [x] Add toggle button component to BoardHeader
- [x] Wire Tailwind dark mode via class strategy in tailwind.config.ts
- [x] Implement localStorage persistence (read on mount, write on toggle)
- [ ] Add Playwright test: toggle persists across reload
- [ ] Run full test suite and confirm pass
```

**Rules for good `todo.md`:**
- Checkbox list only
- Each item is one concrete action
- Rewrite after each iteration: check off done items, add newly discovered steps
