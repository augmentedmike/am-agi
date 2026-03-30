# AM's Brain: A Three-Part Architecture

AM doesn't have a brain in the biological sense. But the system is designed around the same structure that brains use to work effectively — three distinct memory systems, each with a specific job.

---

## The Problem: Agents Are Amnesic

Each time AM runs, it starts with a blank slate. There is no persistent "agent mind" that remembers last Tuesday's work, knows which mistakes have already been made, or holds a plan in memory between runs.

This is a feature, not a bug. A model with internal state is unpredictable — you can't audit what it "knows" or reset it if it learns something wrong. By making agents stateless, the system becomes fully auditable and deterministic. Every bit of state lives in files, not in the model.

But stateless agents still need to know things. That's where the three-part architecture comes in.

---

## The Three Parts

### 1. The Board = Prefrontal Cortex

The prefrontal cortex is the brain's executive center. It holds the current plan, decides what to work on next, and enforces quality standards before an action is taken.

The AM board does exactly this:

**It tracks work.** Every task lives on a card. Cards move through four states — `backlog → in-progress → in-review → shipped` — and the agent always knows where any task stands by reading the board.

**It prioritizes.** Cards have priority levels (`critical → high → normal → low`). AM always works the highest-priority card first. This is the board's attention system — it decides what matters right now.

**It enforces quality gates.** Cards can't jump states. A card can't leave `backlog` without `criteria.md` written. It can't leave `in-progress` without all todo items checked off and tests passing. It can't ship without every acceptance criterion verified. These gates are enforced by code — no agent can override them. This is the prefrontal cortex's "impulse control" — stopping the system from moving forward until the work is actually done.

**It holds task context.** Each card stores its worktree path, work log, and attached documents. The board isn't just a to-do list — it's a complete state record for every piece of work.

---

### 2. Short-Term Memory = Working Memory (Always Active)

Working memory is the cognitive buffer that's always on. It holds the rules you're currently operating under, the immediate constraints, the things you can't afford to forget right now. It's small, fast, and unconditional.

AM's short-term memory lives in `workspaces/memory/st/*.md` — a folder of markdown files. Every agent reads every file in this folder before it starts work. No search required. No retrieval step. Whatever's in `st/` is always available, always applied.

This is where rules like "never use git stash" or "always commit before switching tasks" live. They're not suggestions — they're constants injected into every agent session, every time.

The files are small by design. Short-term memory shouldn't hold everything — just what's unconditionally true.

---

### 3. Long-Term Memory = Searchable Knowledge

Long-term memory is the brain's large knowledge store. You don't hold all of it in your head at once — you retrieve what's relevant when you need it.

AM's long-term memory lives in `workspaces/memory/lt/memory.db` — a SQLite database using FTS5 (full-text search). When an agent needs context, it runs `memory recall "query"`, and the database returns the most relevant entries ranked by relevance.

This is where detailed research notes, project-specific context, older lessons, and rich background knowledge live. The agent asks a question, gets ranked results, and incorporates that context into the current work session.

The key difference from short-term memory: **it requires a query**. Long-term knowledge doesn't inject automatically — the agent must ask for it. This keeps the agent's context clean and focused, only pulling in what's actually relevant.

---

### 4. Git History + Iteration Logs = Episodic Memory

Episodic memory is the brain's record of events: what happened, in what order, when. You can replay the past — "on Monday, I tried X and it failed, so on Tuesday I did Y instead."

AM's episodic memory is the git history, specifically the `iter/*/agent.log` files committed after each agent iteration. Every run produces a log. The commit message timestamps and labels the episode:

```
task-name/iter-3: fixed gate rejection by adding url to research.md
```

The full record is permanent. An agent can read any past iteration's log to understand what was tried, what failed, and what was learned. This is how AM avoids repeating mistakes across sessions — not by the model remembering, but by the history being written and readable.

When a task ships, all the iteration commits are squashed into one clean commit per task. This is the analog of consolidating episodic memory into semantic memory — the noisy step-by-step record compresses into a single meaningful fact: "this task was completed."

---

## Why This Design Works

### No State in the Model

The model carries nothing between runs. All state lives in files. This means:
- Any agent instance can pick up any task by reading the files
- Mistakes can be fixed by editing files — no model retraining needed
- The full history is auditable by any human at any time

### Tier Separation

Each memory tier has a different access pattern by design:
- Board: always read, structured, queryable
- Short-term: always injected, small, unconditional rules
- Long-term: retrieved on demand, large, ranked by relevance
- History: readable on demand, never modified

This mirrors the brain's own architecture, where different memory systems have different speeds, capacities, and access patterns — and the whole works together to produce coherent behavior from a stateless moment-to-moment process.

---

## Summary

| Brain Component | AM Component | Location | Access Pattern |
|---|---|---|---|
| Prefrontal cortex | Board | `apps/board/` | Always active — gates, priority, state |
| Working memory | Short-term memory | `workspaces/memory/st/*.md` | Injected into every agent session |
| Long-term memory | Long-term memory | `workspaces/memory/lt/memory.db` | Queried on demand via `memory recall` |
| Episodic memory | Git history + iter logs | `iter/*/agent.log` | Read on demand, written after each iteration |

The result is an agent that can't "forget" critical rules, can retrieve relevant knowledge, can learn from past mistakes, and always knows what work is in flight — without holding any of this in the model itself.
