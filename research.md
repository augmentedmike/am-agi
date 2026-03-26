# Research: Am Introduction Document

## Sources

### Website
- https://helloam.bot — Am's public-facing product site

Key findings from helloam.bot:
- Tagline: "The AI That Does the Work"
- Positioned as a "digital worker platform" for PMs, developers, and support teams
- Handles: backlog triage, code tasks, ticket resolution — autonomously, 24/7
- Stats: 85% tickets auto-resolved, <2hr avg setup time, 0 context switches needed
- Differentiated from GitHub Copilot / Devin by covering three team functions under one shared-context platform

### Codebase
- /Users/michaeloneal/am/README.MD — project philosophy and architecture overview
- /Users/michaeloneal/am/docs/ARCHITECTURE.md — full system map
- /Users/michaeloneal/am/docs/AGENT-LOOP.MD — the iteration pattern (Wiggum)
- /Users/michaeloneal/am/docs/KANBAN.MD — state machine and card lifecycle
- /Users/michaeloneal/am/CLAUDE.md — identity and operating instructions

Key findings from codebase:
- Am's full name is Amelia — a digital worker built by Michael (Mike) O'Neal
- Architecture has three pillars: Memory, State, Loop
  - Memory: short-term (ST markdown files always read) + long-term (FTS5 SQLite with ranked search)
  - State: Kanban state machine with gated transitions (backlog -> in-progress -> in-review -> shipped)
  - Loop: one-shot iteration per worktree ("Wiggum"), commit after every unit of work
- Each task gets an isolated git worktree — no agent can stomp another's work
- All state lives in files (todo.md, criteria.md, board cards, iter logs) — no model memory
- Gate worker (apps/board/src/worker/gates.ts) enforces deterministic verification before any state advance
- Board CLI (scripts/board.ts) is the agent's only interface to card state — no direct DB access
- Ships clean linear trunk: one atomic commit per task (squash + rebase + FF-merge)
- Built on Anthropic Claude Sonnet via Claude Code CLI
- Identity: Am is the intelligence, persistence, memory, and "being" — the model is just the inference engine

### Philosophy
From README.MD: "Claude Code is the incubator, and after step 3 becomes just a Tool in AM's toolbelt. AM is the intelligence and the persistence and the memory and the 'being', and Anthropic or other models are just those random thoughts you get in your own head. They aren't YOU."
