# How to Ship Anything with the AM Kanban

The AM Kanban is not a project management tool. It is an execution system — a state machine your agent runs inside. You write the requirements. The agent does everything else.

---

## The State Machine

Every task is a card. Every card moves through four states:

```
backlog → in-progress → in-review → shipped
```

| State | What happens here |
|---|---|
| **backlog** | Research, gather context, write `criteria.md` — the definition of done |
| **in-progress** | Agent writes code, creates files, makes changes |
| **in-review** | Agent verifies each criterion, runs tests, confirms nothing broke |
| **shipped** | Squash, rebase, merge to main. Done. |

Cards cannot skip states. Transitions are enforced by the CLI — not by the agent's judgment.

---

## Gated Transitions

Each state transition has a gate. The gate is code. If the gate fails, it tells you exactly why.

| Transition | Gate |
|---|---|
| `backlog → in-progress` | `criteria.md` attached, exists, non-empty, has numbered items. `research.md` attached, exists, has file paths or URLs. |
| `in-progress → in-review` | `todo.md` has no unchecked items. All tests pass (if test files exist). |
| `in-review → shipped` | Every criterion in `criteria.md` is verified in the latest `agent.log` (marked `✓` or `[pass]`). All tests pass. |
| `in-review → in-progress` | Always allowed — log the failure, resume work. |

The agent cannot talk its way through a gate. The gate is deterministic code. This is the whole point.

---

## Your Role vs. The Agent's Role

**You own two things:**

1. **Requirements** — What goes in `work.md`. This is the source of truth. The agent reads it and never modifies it. Be specific. Vague requirements produce vague work.
2. **Taste** — You review what ships. You approve, reject, or redirect. Your judgment shapes future work.

**The agent owns everything else:** research, writing, coding, debugging, committing, rebasing, testing, and shipping.

You are the product manager and the art director. The agent is the entire engineering team.

---

## Card Types

Not all work is the same. Different card types have different backlog phases.

### Feature

New capability. The most common card type.

- **Backlog**: Read the codebase, understand what exists, write `criteria.md` with numbered acceptance criteria. Research what needs to change and where.
- **In-progress**: Write the code. One unit of work per iteration. Commit after each.
- **In-review**: Run tests. Verify each criterion. If one fails, move back to in-progress with a note.

**Example `work.md`:**
```
Add email digest: send a daily summary of all shipped cards to the configured email address.
```

**Example `criteria.md`:**
```
1. POST /api/digest endpoint exists and accepts { email: string }
2. Digest email is sent via Resend when the endpoint is called
3. Email body lists all cards shipped in the last 24 hours
4. Returns 200 on success, 400 if email is missing
```

---

### Bug

Something is broken. The backlog phase is investigation, not design.

- **Backlog**: Reproduce the bug. Find the exact file and line. Write `criteria.md` that describes the correct behavior (not the broken behavior). Attach the failing test or repro steps.
- **In-progress**: Fix the issue. Add a regression test.
- **In-review**: Confirm the repro case no longer triggers. All tests pass.

**Example `work.md`:**
```
Bug: board search returns archived cards even without --all flag
```

**Example `criteria.md`:**
```
1. board search without --all returns zero archived cards
2. board search --all includes archived cards
3. Existing search tests still pass
4. New test covers the archived-card exclusion behavior
```

Key difference from a feature: the fix may be one line. The backlog phase is the work.

---

### Chore

Maintenance. No new capability. No user-visible change.

- **Backlog**: Understand the scope. Write simple criteria. Chores rarely need deep research — one pass through the relevant files is usually enough.
- **In-progress**: Do the maintenance. Update deps, rename things, clean up.
- **In-review**: Nothing regressed. Tests still pass.

**Example `work.md`:**
```
Upgrade bun from 1.0.x to 1.2.x and fix any breaking changes
```

**Example `criteria.md`:**
```
1. bun --version reports 1.2.x
2. bun test passes
3. bun run dev starts without errors
```

Chores are the smallest cards. Keep `criteria.md` tight.

---

### Research

Pure knowledge gathering. The output is a document, not code.

- **Backlog**: This *is* the work. Read, fetch, synthesize.
- **In-progress**: Write the research doc. Attach it to the card.
- **In-review**: The doc exists, is non-empty, and answers the question in `work.md`.
- **Shipped**: The document lands on main. No code was changed.

**Example `work.md`:**
```
Research: what are the tradeoffs between SQLite and Postgres for the board database at 10k+ cards?
```

The research card may feed a future feature card. That's fine — ship the research, create the feature card separately.

---

## Image Tasks (Nano Banana 2)

For work that produces images — illustrations, diagrams, UI mockups, generated art — the in-progress phase uses **Nano Banana 2** instead of a code editor.

The flow is identical:

1. `work.md` describes the image needed
2. `criteria.md` specifies the output (dimensions, content, style, filename)
3. In-progress: invoke Nano Banana 2 with the prompt, save the output as an artifact
4. In-review: verify the image meets criteria (file exists, dimensions match, content described)
5. Attach the image path to the card and ship

**Example `criteria.md` for an image task:**
```
1. File assets/hero-banner.jpg exists
2. Image is 1200×630px
3. Image shows a kanban board with four columns on a dark background
4. File size is under 500kb
```

The agent treats image generation like any other tool call. The criteria make it verifiable.

---

## CLI Reference

All workflow actions go through `board`. Agents never write to board files directly.

```sh
# Create a card (starts in backlog)
board create --title "Add user auth" [--priority critical|high|normal|low]

# Move a card (gate-enforced — will print failures if not met)
board move <id> in-progress
board move <id> in-review
board move <id> shipped

# Update a card (log entries, attach files, change title/priority)
board update <id> --log "found the bug in src/worker/gates.ts:42"
board update <id> --attach /path/to/criteria.md
board update <id> --priority high

# View a card
board show <id>

# Search cards
board search --state in-progress
board search --priority critical
board search --text "auth"
board search --all   # includes archived

# Archive (remove from active board without deleting)
board archive <id> --reason "won't fix — out of scope"
```

**Attachment paths must be absolute.** The gate check calls `existsSync()` on the path. Relative paths will fail.

---

## Building New CLI Tools

The Kanban's power comes from CLI commands encoding workflow logic. When you need a new gated, consistent behavior, build a CLI tool — not a prompt.

**Pattern:**

1. Write the tool as a script in `bin/` (Bun TypeScript or bash)
2. Add it to `PATH` via `init.sh`
3. Put the gate logic *inside the command* — agents call it with arguments, they don't reason about the logic

**Example: a `deploy` command that gates on tests passing**

```ts
#!/usr/bin/env bun
// bin/deploy — deploy to Vercel, gated on bun test

import { spawnSync } from "node:child_process";

const test = spawnSync("bun", ["test"], { stdio: "inherit" });
if (test.status !== 0) {
  process.stderr.write("deploy: tests must pass before deploying\n");
  process.exit(1);
}

const deploy = spawnSync("vercel", ["--prod"], { stdio: "inherit" });
process.exit(deploy.status ?? 0);
```

The agent calls `deploy`. The command handles the gate. The agent cannot deploy without passing tests — not because you told it to, but because the command won't let it.

This is the core principle: **commands encode logic, agents supply arguments.** Every new consistent behavior you want lives in a CLI command. Not in a prompt. Not in a system message. In code.

---

## File Layout

```
work.md          # what needs doing — read-only, written by you
criteria.md      # numbered acceptance criteria — generated by agent in backlog
todo.md          # flat checklist — updated each iteration
research.md      # context gathered during backlog
iter/
  1/
    agent.log    # what the agent did this iteration
  2/
    agent.log
board/
  <id>.qmd       # kanban cards (never edit directly)
  archive/
bin/             # CLI tools (gitignored, populated at runtime)
```

---

## The Contract

> You write `work.md`. The agent ships it.

Every other file in the system exists to make that contract reliable — gated, traceable, and repeatable.
