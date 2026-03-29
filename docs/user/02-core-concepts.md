# Core Concepts

AM is built on three things. That's it.

---

## 1. Memory

AM doesn't forget between sessions. Memory is stored locally on your machine — not in a cloud service, not in the model's context window, not in a database you can't inspect.

Two tiers:

| Tier | Where | When to use |
|------|-------|-------------|
| **Short-term (ST)** | `workspaces/memory/st/*.md` — plain Markdown | Rules, lessons, "never do X" facts. Short. Always read in full at the start of every agent run. |
| **Long-term (LT)** | `workspaces/memory/lt/memory.db` — SQLite FTS5 | Detailed context, research findings, history. Ranked text search. |

AM writes its own memories as it works. You can write them too:

```sh
memory add "never use git stash — causes merge conflicts" --st
memory add "the board schema lives in apps/board/src/db/schema.ts" --lt
```

See [Memory System](05-memory-system.md) for the full reference.

---

## 2. State Machine

Every task is a card on the Kanban board. Every card moves through exactly four states:

```
backlog → in-progress → in-review → shipped
```

Cards cannot skip states. Transitions are enforced by code — not by the agent's judgment. If a gate condition isn't met, the move is rejected and you see exactly why.

| State | What's happening |
|-------|-----------------|
| **backlog** | Research and prep. AM reads docs, explores the codebase, writes acceptance criteria. |
| **in-progress** | Implementation. AM writes code, creates files, makes changes. |
| **in-review** | Verification. AM runs tests, checks each criterion, confirms nothing regressed. |
| **shipped** | Done. Squash, rebase, merge to dev. |

Cards are worked in priority order: `critical → high → normal → low`. The dispatcher always picks the highest-priority card.

See [Kanban & Cards](03-kanban-cards.md) for the full state machine and gate conditions.

---

## 3. Agent Loop

AM runs in one-shot iterations. Each iteration:

1. Reads `todo.md` and the board card for current state
2. Pulls memory context (`memory recall`)
3. Does exactly one meaningful unit of work
4. Writes `iter/<n>/agent.log`
5. Rewrites `todo.md` (checks off completed steps, notes what's next)
6. Commits everything
7. Outputs `DONE`

The dispatcher picks up the next iteration, or moves the card to the next state when the gate is satisfied.

**No state is carried in the model's memory.** All state lives in files: `todo.md`, `criteria.md`, board cards, `iter/*/agent.log`, and the memory store. This means every action is auditable — it's all in git.

Each card gets its own isolated git worktree:

```
worktrees/
  <card-slug>/
    work.md        # what needs doing (read-only — written by you or the system)
    criteria.md    # acceptance criteria (written by AM in backlog)
    todo.md        # flat checklist (rewritten each iteration)
    research.md    # context gathered (written by AM in backlog)
    iter/
      1/agent.log
      2/agent.log
      ...
```

**1 card = 1 worktree = 1 branch = 1 agent loop.**

See [Kanban & Cards](03-kanban-cards.md) and the [CLI Reference](04-cli-reference.md) for how to interact with the system.
