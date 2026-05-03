# AM Positioning: Two Audiences, One Platform

AM is not a single-purpose tool. Different people use it for different reasons. This document helps you find the right path.

---

## Who Are You?

### 🏗️ [Harness Engineer →](harness-engineer.md)

You're building an agent framework, harness, or orchestration system. You care about architecture: adapter interfaces, gate workers, worktree isolation, stateless agent design, and how to make agents that can't skip quality. You want a reference architecture you can learn from or adopt.

**Read this if:** You're evaluating agent frameworks (LangChain, CrewAI, OpenAI Agents SDK, OpenClaw) and want to see a different approach — one built on narrow, deterministic channels with server-side verification instead of agent self-certification.

➡️ [Go to Harness Engineer Positioning](harness-engineer.md)

### 💻 [Software Engineer →](software-engineer.md)

You write code every day and want an AI agent that helps you ship faster. You care about workflow: the CLI, the Kanban board, gated transitions, git traceability, and a system where you define what "done" looks like and the agent does the rest. You want to know: "how much faster will I ship?" and "can I trust the results?"

**Read this if:** You've tried Claude Code, Cursor, Copilot, or other coding assistants and want something that manages the *entire* project lifecycle — from idea to shipped card — with memory, traceability, and a safety net that prevents bad code from landing.

➡️ [Go to Software Engineer Positioning](software-engineer.md)

---

## Companion Documents

- **[`messaging.md`](../messaging.md)** — For small-team founders and business owners. If you're not evaluating AM as a technical artifact but as a team multiplier — "run like a 20-person team, stay a team of 3" — this is your document. It covers use cases (support, sales, marketing, ops, finance) and cost framing. It coexists with these positioning docs rather than being replaced by them. Different audience, same platform.

---

## Quick Orientation

| Dimension | Harness Engineer | Software Engineer |
|-----------|-----------------|-------------------|
| **Primary question** | "How is this architected?" | "Does this ship my code?" |
| **Key reference** | `agent/src/loop/adapter.ts`, `board/src/worker/gates.ts` | `bin/board`, `work.md`, `criteria.md`, `todo.md` |
| **Comparison set** | LangChain, CrewAI, OpenAI Agents SDK, OpenClaw, Claude Code | Claude Code, Cursor, Copilot |
| **Risk concern** | Architectural unsoundness, security vulnerabilities | Agent shipping broken code, losing context between sessions |
| **AM's answer** | Narrow channels + server-side verification + stateless agents | CLI workflow + gated transitions + git traceability + persistent memory |
