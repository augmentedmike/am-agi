# Steps

A guide to building an agent-driven development system.

| Step | Summary |
|---|---|
| [1. Init your agent](1.md) | Run `/init` to bootstrap Claude Code for the session. |
| [2. The Agent Loop](2.md) | A one-shot Wiggum loop driven entirely by filesystem state — `work.md` in, memory files out, repeat. |
| [3. The Runner](3.md) | Orchestrates Wiggum loops against a Kanban board, enforcing column gates and injecting per-column system prompts. |
| [4. Agent Visibility](4.md) | Claude Code runs in print mode with JSON I/O; every iteration commits its full output to git as the permanent work record. |
| [5. The Kanban Board](5.md) | The agent's prefrontal cortex — a Next.js/SQLite state machine encoding agile process, mechanistic interpretability, and long-term vector memory. |
| [6. The CLI Layer](6.md) | Process work goes through deterministic CLI tools, not model reasoning — the `board` tool gates card transitions through a verifying worker, not the agent's self-report. |
