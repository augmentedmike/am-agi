# Tutorial

Build AM from scratch, in order. Each step is a prompt you give Claude Code.

---

## Phases

### A. Bootstrap (Steps 1–4)
Build the scaffolding: CLAUDE.md, init.sh, the board CLI, the kanban schema, and the agent loop. All written by hand — no dogfooding yet.

### B. Build the web app (Steps 5–10)
Scaffold the Next.js board, add gate logic, style it, wire up the dispatcher, and add LaunchAgents. At the end of step 10, AM is running itself: the New Card Panel feature was built entirely by the system it was written on.

### C. Dogfood to MVP (Steps 11–12)
Everything after step 10 is built by AM. Multi-project routing, settings, context management, cross-platform install. By step 12 the system runs on any machine.

---

## Steps

| Step | What gets built |
|---|---|
| [1](1.md) | CLAUDE.md — agent orientation file |
| [2](2.md) | init.sh + bin/ scaffolding |
| [3](3.md) | Board CLI + kanban schema |
| [4](4.md) | Agent loop (runIteration) |
| [5](5.md) | Next.js board app scaffold |
| [6](6.md) | Gate worker + state transition enforcement |
| [7](7.md) | Glass card UI, dark theme, Tailwind 4 |
| [8](8.md) | Column prompts, gate checks |
| [9](9.md) | Card panel, ship flip animation |
| [10](10.md) | Dispatcher + LaunchAgents (macOS) |
| [11](11.md) | Multi-project routing, settings, context budget |
| [12](12.md) | Cross-platform install (Linux + Windows) |
