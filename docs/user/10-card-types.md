# Card Types

Cards are categorized by the kind of work they represent. Use the title prefix as a convention — AM doesn't enforce types, but consistent naming makes `board search` more useful.

---

## Feature

New capability added to the system.

**Title pattern:** `feat: <what it does>`

**Example `work.md`:**
```markdown
# feat: export board to CSV

Add a CLI command `board export --format csv` that writes all non-archived
cards to stdout as CSV. Columns: id, title, state, priority, created_at.
Include header row.
```

---

## Bug

Something that is broken and needs to be fixed.

**Title pattern:** `bug: <what's broken>`

**Example `work.md`:**
```markdown
# bug: board move fails silently when gate rejects

When `board move` is called and the gate rejects the transition, the command
exits 0 and prints nothing. It should exit non-zero and print the rejection
reason to stderr.

Reproduce: create a card, skip writing criteria.md, run `board move <id> in-progress`.
```

---

## Chore

Maintenance work with no user-visible change.

**Title pattern:** `chore: <what's being maintained>`

**Example `work.md`:**
```markdown
# chore: upgrade Bun to 1.2.x

Bun 1.2.x is stable. Update the project runtime:
- Update `.bun-version`
- Update all lockfiles
- Confirm `bun test` still passes after upgrade
```

---

## Research

Investigation with a written output — no code required.

**Title pattern:** `research: <what's being investigated>`

**Example `work.md`:**
```markdown
# research: evaluate vector DB options for LT memory

Compare pgvector, Chroma, and LanceDB for replacing the current FTS5
SQLite store. Criteria: query latency <50ms at 100k entries, Bun-compatible
client, no Docker dependency.

Deliverable: decision written to research.md with recommendation and rationale.
```
