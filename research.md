<<<<<<< HEAD
# Research: HOWTO-KANBAN.md

## Task Classification
NON-CODE TASK — documentation explaining the AM Kanban system to new users.

## Source Files Reviewed

- `CLAUDE.md` — full agent loop, CLI commands, ship script, design principles
- `docs/KANBAN.MD` — state machine, gated transitions, priorities, work log, attachments
- `docs/CLI.MD` — board command reference, card format
- `docs/AGENT-LOOP.MD` — one-shot loop, iteration structure, git history shape
- `README.MD` — project philosophy, architecture overview
- `docs/TOOLS.md` — tools available to agent

## Key Concepts to Cover

### The State Machine
Four states: `backlog → in-progress → in-review → shipped`
Each transition is gated — criteria must be met, enforced by CLI, not by model memory.

### Card Types (what the HOWTO should differentiate)
- **Feature**: New capability to build. Has design phase (backlog), implementation (in-progress), verification (in-review).
- **Bug**: Something broken. Backlog is investigation/repro. In-progress is the fix. In-review is regression test.
- **Chore**: Maintenance task (dependency update, refactor, cleanup). No design needed — criteria is simpler.
- **Research**: Pure knowledge gathering. May produce a doc or criteria for a future card. Ships as a completed doc.

### Image Tasks / Nano Banana 2
"Nano Banana 2" is a reference to an image generation model (Flux Nano or equivalent). Image tasks follow the same kanban flow but the in-progress phase uses an image model tool rather than a code editor. The output is an image artifact attached to the card.

### CLI-as-guardrail Philosophy
Commands encode the logic; the agent supplies arguments. This is the key insight — the model can't hallucinate workflow state because every transition is enforced by deterministic code. See: `docs/CLI.MD`.

### Human Role
The human owns two things:
1. **Requirements** — what goes in `work.md` (the source of truth for the task)
2. **Taste** — approval/rejection signals that shape future work

The agent does research, writing, coding, debugging, committing, rebasing, and shipping.

### Building New CLI Tools
New gated workflows are CLI commands. Pattern:
1. Write the command logic as a script in `bin/`
2. Add it to PATH via `init.sh`
3. Gate check logic lives inside the command — agents call it, they don't implement the logic

## References
- https://en.wikipedia.org/wiki/Kanban_(development) — Kanban origin and principles
- `docs/KANBAN.MD` — gated transitions reference
- `docs/AGENT-LOOP.MD` — one-shot loop pattern
- `CLAUDE.md` — CLI command reference
=======
# Research

## Task
Hide overflowing content in the card panel's attachment image container.

## File
`apps/board/src/components/CardPanel.tsx`

### Relevant Section (lines 415–440)

```tsx
// line 415
<div className="flex flex-col gap-3">
  {card.attachments.map((att) => (
    <div key={att.path} className="flex flex-col gap-1">   // line 417
      {att.path.match(...) ? (
        <a href={att.path} target="_blank" ... className="block">  // line 419
          <img
            src={att.path}
            alt={att.name}
            className="max-h-48 rounded border border-white/10 object-contain bg-zinc-800"
          />                                                // line 424
          <span ...>{att.name}</span>
        </a>
      ) : ( ... )}
    </div>
  ))}
</div>
```

## Root Cause

The `<img>` element has `max-h-48` and `object-contain` but **no `max-w-full`** and the wrapping `<a>` / `<div>` containers have **no `overflow-hidden`**. Wide images (e.g., landscape screenshots) can extend beyond the panel's right edge.

## Fix

Add `overflow-hidden` to the `<a>` tag (line 419) that wraps the image. This clips any overflow from the image without affecting the layout.

Alternatively, add `max-w-full` to the `<img>` element itself (simpler, more targeted).

Both `overflow-hidden` on the wrapper `<a>` and `w-full` + `max-w-full` on the `<img>` are standard patterns for this.

Chosen fix: add `overflow-hidden` to the `<a>` wrapper (line 419) — it already has `block` display, making it a valid overflow container.

### Target line
`apps/board/src/components/CardPanel.tsx:419`
>>>>>>> 1863a61 (8fdb9e54: hide overflow on attachment image container in CardPanel)
