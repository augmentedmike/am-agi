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
| [7. Board Housekeeping and Visual Design](7.md) | Archive test seed cards and restyle the board with a zinc/glass dark theme, single pink accent, full-height independent-scrolling columns, and a collapsible Shipped column. |
| [8. Column Gates and Column Prompts](8.md) | Richer gate checks (research quality, test detection, code quality scan) and column prompts that tell the agent exactly what to do in each column. |
| [9. The First Real Card](9.md) | Create the first real board card and work it end-to-end: glass card design, slide panel, active agent indicator, top bar active count. |
