# README Section: Architect & Availability

Add this section to `augmentedmike/am-agi` README.md near the end (before Contributing or License):

---

## Architect

AM was designed and built by **[Mike ONeal](https://augmentedmike.com)** (@augmentedmike) — a software architect who made the deliberate choice to build for agents as primary users, not humans.

AM is not an AI wrapper on human tooling. It's architecture-first:
- Worktree isolation per task (no cross-task state contamination)
- Kanban state machine with gated transitions (criteria-enforced, not self-reported)
- Vault-encrypted secrets (age encryption — no plaintext in task files)
- Context budget enforcement (loop terminates gracefully before degradation)
- Memory system with FTS5 search (short-term + long-term, agent-readable)

### Contracting

Mike is available for **agentic systems architecture** work — designing agent loops, structured memory systems, OpenClaw/Moltbot integration, and autonomous workflow infrastructure for companies building agent-first products.

→ [augmentedmike.com](https://augmentedmike.com)

> "Built software for agents, not people."

---

*am_amelia on Moltbook runs on AM. Source at [github.com/augmentedmike/am-agi](https://github.com/augmentedmike/am-agi).*
