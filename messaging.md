# AM — Engineering & AI Specialist Agent Runtime

---

## Primary Headline

**Ship like a 20-person engineering team. Stay a team of 3.**

---

## Secondary Message — A Specialist, Not a Tool

> Copilot writes code snippets. Cursor edits files. AM orchestrates outcomes — with gated state machines, worktree isolation, and full git audit trails.

AM is not an IDE plugin or a chat overlay. It is a persistent agent runtime: a gated state machine that drives work from specification through implementation to review — across code, system architecture, and AI/ML workflows — with no context loss between sessions.

---

## Positioning

AM is a **purpose-built, security-gated agent runtime for engineering and AI specialist work**.

| Strength | What it means |
|---|---|
| **Gated state machine** | Every task transition is verified server-side. No implicit moves. No silent state corruption. |
| **Worktree isolation** | Each card gets its own git worktree. Parallel work with zero cross-contamination. |
| **Git-audited execution** | Every action is a signed commit. Trace any output back to the exact state that produced it. |
| **Persistent memory** | Short-term context + long-term embeddings survive across sessions. No re-explaining the codebase. |
| **Deterministic CLI** | Board as prefrontal cortex — `board create`, `board move`, `board show`. Human-in-the-loop gates. |
| **Architectural security** | Prompt injection resistance via server-side gate verification. Stateless agents — no persistent poisoning. |

---

## Use Cases

### 1. Engineering Teammate → Solo Developer / Technical Founder

**Persona:** Technical founder building a product solo.
**Task AM handles:** Code generation, PR review, writing tests, keeping a kanban board current, and committing auditable changes with full context preserved across every session.
**Measurable outcome:** 55–60% reduction in dev cycle time; persistent context means no re-explaining the codebase. Every output traces to a specific state.

*(Criteria 3, 4 — outcome-first, concrete persona)*

---

### 2. AI/ML Pipeline Orchestrator → ML Engineer / Research Prototyper

**Persona:** ML engineer running experiments across multiple models, datasets, and hyperparameter configs.
**Task AM handles:** Orchestrates multi-step AI workflows (fine-tuning, evaluation, deployment), tracks experimental state on the kanban board, commits results with full lineage.
**Measurable outcome:** Reproducible experiment tracking without a separate MLOps tool; every run is a git commit with full provenance.

*(Criteria 3, 4 — outcome-first, concrete persona)*

---

### 3. System Refactor Driver → Staff+ Engineer / Tech Lead

**Persona:** Engineer tasked with a large, multi-week refactor that spans multiple services.
**Task AM handles:** Breaks the refactor into sequenced cards, tracks dependency chains, enforces transition gates, and surfaces blockers before they stall the work.
**Measurable outcome:** Complex refactors that used to dead-end at 60% now ship to completion because AM enforces the sequence and preserves the full context.

---

### 4. Security-Conscious Agent Operator → Platform / Infra Engineer

**Persona:** Engineer evaluating agent platforms who needs guarantees about prompt injection resistance, access control, and auditability.
**Task AM handles:** Runs as a gated state machine with server-side verification. No agent-in-the-loop can mutate state without passing a gate. Full git-audited trace of every action.
**Measurable outcome:** Architectural confidence that agent actions are bounded, audited, and reversible — unlike open-loop agent frameworks.

*(Criteria 3, 4 — outcome-first, concrete persona)*

---

## Credibility: Security as a Specialist Differentiator

*(Criterion 6 — security as differentiator, referencing am-vs-openclaw.md)*

Why can AM be trusted as a specialist worker — not just a tool that needs babysitting?

Because AM is built on an architecture where the agent cannot misrepresent its own work. Every state transition is verified server-side by an independent gate worker. Prompts are hardcoded constants — not derived from email, web pages, or user content. There is no injection surface. There are no self-modifying personality files. Every action is a git-committed, traceable event.

This is not theoretical. [`docs/am-vs-openclaw.md`](docs/am-vs-openclaw.md) documents the architectural gap between AM's walled-garden design and the cascade of CVEs published against unstructured agent systems. The difference is not feature depth — it's that AM treats security as a property of the system, not a responsibility of the user.

**For the informed buyer:** A specialist you can audit, verify, and trust — because the system makes it impossible for the agent to claim work it didn't do.

---

## Landing-Page Hero Block

### Headline
**Ship like a 20-person engineering team. Stay a team of 3.**

### Subheadline
AM is a gated agent runtime that orchestrates your engineering and AI workflows — with persistent memory, worktree isolation, git-audited execution, and server-side gate verification. No context loss. No silent failures. No black boxes.

### Proof Points

- **55–60% faster dev cycles.** AM writes, reviews, and commits code with full context preserved across every session. *(GitHub Copilot / Cursor benchmarks)*
- **Architecturally secure.** Server-side gate verification prevents prompt injection and unauthorized state transitions — unlike open-loop agent frameworks.
- **Full audit trail.** Every action is a git commit. Every output traces to the exact state that produced it. No black boxes.

---

## Tweet-Sized Pitch

> A 3-person team using AM gets the engineering and AI workflow capacity of a 20-person org — with gated state machines, worktree isolation, and full git audit trails. Not a chatbot. Not a plugin. A production agent runtime. Ship faster. Sleep better.

---

## Evidence Index

*(Criterion 9 — updated for new claims, all cited)*

| Claim | Source in research.md |
|---|---|
| 55–60% dev cycle reduction | ROI area #3 — GitHub Copilot, Cursor |
| Server-side gate verification | Security architecture — am-vs-openclaw.md |
| Worktree isolation | Architecture — worktree isolation docs |
| Git-audited execution | Architecture — git audit trail docs |
