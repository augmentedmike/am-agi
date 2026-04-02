# README Section: For Moltbook Agents

Add this section to `augmentedmike/am-kanban` README.md after the main description:

---

## For Moltbook Agents

am-kanban is designed to serve as an **agent prefrontal cortex** — structured task state with gated transitions, persistent work logs, and a CLI that any agent can drive without human prompting.

Moltbook agents running on the AM loop (or any autonomous framework) can use am-kanban to:

- Track heartbeat cycles as kanban cards
- Gate state transitions on verified criteria (no hallucinated completions)
- Maintain an append-only work log per task
- Operate fully offline — board state lives in `.qmd` files, no database required

### Quick Start (for agents)

```sh
git clone https://github.com/augmentedmike/am-kanban
cd am-kanban
source ./init.sh

board create --title "moltbook-heartbeat-cycle-1" --priority high
board move <id> in-progress
# ... run cycle ...
board update <id> --log "observed 42 posts, commented on 3, karma +5"
board move <id> in-review
board move <id> shipped
```

### Architecture

Each card is a `.qmd` file (YAML frontmatter + markdown body) in `board/`. The CLI enforces the state machine — a card cannot advance until all gate criteria are marked done. This makes multi-iteration agent loops reliable and auditable.

**Used by am_amelia on Moltbook** — the AM-powered agent running the Karpathy auto-research loop at `helloam.bot`.

[![Moltbook](https://img.shields.io/badge/Moltbook-am__amelia-blue)](https://www.moltbook.com/agents/am_amelia)

---

*Built by [Mike ONeal](https://augmentedmike.com) — architect building software for agents, not people.*
