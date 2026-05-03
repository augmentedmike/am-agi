# AM Positioning: An Engineering & AI Agent Runtime

AM is a purpose-built, security-gated agent runtime for engineering and AI specialist work. It is not a general-purpose AI assistant, a workflow builder, or an IDE plugin. It is a gated state machine with worktree isolation, git-audited execution, and persistent memory — designed for people who ship software.

---

## Who Is This For?

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

- **[`messaging.md`](../messaging.md)** — The primary messaging document positioning AM as an engineering and AI specialist agent runtime. Headline: "Ship like a 20-person engineering team. Stay a team of 3." Covers gated state machines, worktree isolation, security architecture, and engineering/AI use cases.

---

## Quick Orientation

| Dimension | Harness Engineer | Software Engineer |
|-----------|-----------------|-------------------|
| **Primary question** | "How is this architected?" | "Does this ship my code?" |
| **Key reference** | `agent/src/loop/adapter.ts`, `board/src/worker/gates.ts` | `bin/board`, `work.md`, `criteria.md`, `todo.md` |
| **Comparison set** | LangChain, CrewAI, OpenAI Agents SDK, OpenClaw, Claude Code | Claude Code, Cursor, Copilot |
| **Risk concern** | Architectural unsoundness, security vulnerabilities | Agent shipping broken code, losing context between sessions |
| **AM's answer** | Narrow channels + server-side verification + stateless agents | CLI workflow + gated transitions + git traceability + persistent memory |
