# AM User Documentation

AM (AugmentedMe) is a **gated agent runtime for engineering and AI specialist work** — a persistent, security-gated orchestration engine with server-side state machine verification, worktree-isolated execution, git-audited provenance, and persistent memory.

This documentation covers everything you need to run it, use it, and extend it.

---

## Contents

| Doc | What it covers |
|-----|----------------|
| [01 — Getting Started](01-getting-started.md) | Install, bootstrap, first card |
| [02 — Core Concepts](02-core-concepts.md) | Gated state machine, worktree isolation, agent loop, security architecture |
| [03 — Kanban & Cards](03-kanban-cards.md) | States, gated transitions, priorities, card format |
| [04 — CLI Reference](04-cli-reference.md) | Every `board` command with flags and examples |
| [05 — Memory System](05-memory-system.md) | Short-term vs long-term memory, all `memory` commands |
| [06 — Vault](06-vault.md) | Encrypted secrets management |
| [07 — Web Search](07-web-search.md) | Search providers, setup, round-robin |
| [08 — Git Workflow](08-git-workflow.md) | Branch model, commit rules, banned operations |
| [09 — Writing Good Work](09-writing-good-work.md) | `work.md`, `criteria.md`, `todo.md` with examples |
| [10 — Card Types](10-card-types.md) | Feature, bug, chore, research — with examples |
| [11 — Troubleshooting](11-troubleshooting.md) | Gate rejections, common failures, bug reporting |

---

## Quick reference

```sh
# Bootstrap every session
source ./init.sh

# Create a card
board create --title "Your task here" --priority high

# Check what's in progress
board search --state in-progress

# Read a card
board show <id>

# Save a memory
memory add "never do X" --st

# Store a secret
vault set MY_API_KEY
```
