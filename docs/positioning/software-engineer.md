# AM for Software Engineers: Ship Code Faster with a Persistent AI Teammate

*AM is not another code completion tool. It's a persistent digital worker that manages your entire project lifecycle — from idea to shipped card — with memory, traceability, and a safety net that prevents bad code from landing.*

---

## Who This Is For

You write code every day — solo, on a small team, or as a founder. You've tried Claude Code, Cursor, Copilot, and maybe even Claude Tasks. They help with individual moments of coding, but they don't *own outcomes* across sessions. You still re-explain your project state every time. You still context-switch between your editor, your task tracker, and your terminal. You still ship broken code because the AI said it was done and you didn't double-check.

AM is different. This document shows you exactly how.

---

## Shipping Code Faster with AM

AM replaces the overhead of managing tasks yourself with a simple workflow that takes you from idea to shipped code with full traceability.

### The CLI Workflow

```bash
# 1. Describe the work
board create --title "Add row-level caching to API" --priority high

# AM reads the card, researches the codebase, writes criteria:
#   criteria.md → numbered acceptance criteria
#   research.md → relevant source files and line numbers
#   todo.md     → flat checklist of implementation steps

# 2. AM implements — you review the plan
# AM picks up the in-progress card, works through todo.md,
# writes code, writes tests, commits everything.

# 3. AM requests review — gates catch anything wrong
board move <id> in-review
# Gate checks: todo complete? Tests pass? Enough iterations run?

# 4. AM verifies — every criterion checked against real results
board move <id> shipped
# Gate checks: agent.log has ✓ for every criterion? Tests still pass?
# Code quality violations? All clean → shipped.
```

**This workflow reduces developer overhead in three ways:**

1. **No context-switching** — You stay in one tracking surface (the board). AM does research, implementation, and verification in the same loop. You don't need a separate spec doc, task tracker, and review tool.
2. **No re-explaining** — AM remembers your project state across sessions. It reads `am.project.json`, the codebase, and the card context every time. You don't recap what was discussed last week.
3. **No manual quality gates** — AM writes criteria before writing code. Tests are required before review. Everything is verified before shipped. You don't need a separate CI/CD pipeline for agent-worked cards — AM's gate worker is that pipeline.

### What This Looks Like in Practice

**Before AM:** You write a spec, put it in a ticket, open your editor, start implementing, realize you missed something, go back to the spec, write tests, create a PR, wait for review, fix review comments, merge. Each of these is a context switch.

**With AM:** You write a card title. AM researches the codebase, writes acceptance criteria you can review in 30 seconds, implements the code, writes tests, commits everything, and requests review. If something fails, it goes back and fixes it. You don't context-switch — you examine the result.

---

## The Safety Net

The most dangerous thing about AI coding assistants is that they don't know when they're wrong. They confidently assert they've finished, shipped working code, and covered all the edge cases — but there's no verification. The agent is judge in its own case.

AM's gate worker is the difference.

### Gated Transitions: What the Gate Actually Checks

Every card transition has hard requirements that the agent **cannot skip, override, or lie about:**

| Transition | Gate Check | What Happens If It Fails |
|---|---|---|
| `backlog → in-progress` | criteria.md exists with numbered items + research.md exists with file paths or URLs | Agent writes the missing file and retries |
| `in-progress → in-review` | todo.md has no unchecked items + bun test passes | Agent finishes remaining steps or fixes broken tests |
| `in-review → shipped` | Every criterion has ✓ in agent.log + tests pass + no code quality violations | Agent fixes specific failing criteria |

### How This Prevents Bad Code from Landing

**No agent self-certification.** The gate doesn't ask the agent "did you finish?" — it reads `todo.md` and checks for unchecked items. An agent that writes "all done" in its log but leaves `- [ ]` in `todo.md` gets blocked.

**Tests are re-run server-side.** The agent might write "all tests pass" in its log. The gate doesn't care. It runs `bun test` again and checks the exit code. If tests fail, the gate rejects — even if the agent confidently claims otherwise.

**Every criterion must be explicitly verified.** The agent.log must contain a `✓` marker next to the text of each criterion from criteria.md. The gate does a text scan — it's looking for "✓ Add row-level caching to API" in the log. If any criterion is missing its checkmark, the transition is blocked.

**Code quality rules are enforced automatically.** If `docs/CODE_QUALITY.md` exists and contains "never do" patterns, the gate scans `git diff` for those patterns in new code. Violations block shipping.

### What This Means for You

- **You don't need to review every line of agent-written code** — the gate already verified that tests pass, criteria are met, and code quality rules are followed. Your review can focus on architecture and intent.
- **You can't be tricked** — an agent that looks done but isn't can't ship. The gate doesn't take the agent's word for anything.
- **You get auditable history** — every iteration is a git commit. You can see exactly what changed, when, and why. No black boxes.

---

## Getting Started in 5 Minutes

### Prerequisites

- macOS, Linux, or Windows
- An API key (Anthropic Claude, or any OpenAI-compatible provider)

### Step 1: Install

```bash
# Mac/Linux
curl -fsSL https://raw.githubusercontent.com/augmentedmike/am-agi/main/install.sh | bash

# Windows
irm https://raw.githubusercontent.com/augmentedmike/am-agi/main/install.ps1 | iex
```

### Step 2: Start the Board

After installation, the board starts automatically at `http://localhost:4220`. Open it in your browser and sign in with your API key.

### Step 3: Create Your First Card

```bash
source ./init.sh
board create --title "Add a health check endpoint" --priority high
```

### Step 4: Watch It Ship

Open the board UI at `http://localhost:4220`. Your card is in **backlog**. AM will:
1. Research the codebase and write criteria (moves to **in-progress**)
2. Implement the code and write tests (moves to **in-review**)
3. Verify everything passes and ship it (moves to **shipped**)

You watch. AM works.

### Step 5: Check the Result

```bash
board show <id>
# See the full history: criteria, iterations, verification results
git log --oneline
# Every step is a commit traceable to the card
```

**That's it.** From zero to a shipped card in under 5 minutes.

---

## How AM Compares to Other Developer Tools

| Dimension | AM | Claude Code | Cursor | GitHub Copilot | Claude Tasks |
|---|---|---|---|---|---|
| **Scope** | Project lifecycle (idea → shipped) | In-terminal coding | In-editor coding | Code completion + chat | Single task execution |
| **Memory** | Persistent across sessions (ST + LT embeddings) | Session-only | Session-only | Session-only | Session-only |
| **Task management** | Built-in Kanban board with gated transitions | No built-in task management | No built-in task management | No built-in task management | No built-in task management |
| **Quality gates** | Server-side, agent cannot self-certify | None (agent reports results) | None (agent reports results) | None (suggestions only) | None (agent reports results) |
| **Git integration** | Every iteration is a commit; squash-before-ship | Session transcripts (no commits) | Inline diffs (no commits) | Inline suggestions (no commits) | Session transcripts |
| **Multi-model** | Yes (adapter interface: Claude, DeepSeek, Qwen, etc.) | Anthropic-only | Multi-model (chat) | OpenAI/GitHub models | Anthropic-only |
| **Audit trail** | Full: criteria.md → agent.log → git commits | Session replay only | No persistent audit trail | No persistent audit trail | No persistent audit trail |

---

## Tips for Getting the Most Out of AM

### Write Good Card Titles

The card title is the seed for everything. Be specific about what you want:

- ❌ "Fix bugs" → vague, no criteria to verify against
- ✅ "Add input validation to the signup form" → clear, testable

### Review Criteria Before AM Starts Coding

When AM moves a card from backlog to in-progress, it attaches `criteria.md`. Read it. If the criteria are wrong, update the card title or add notes. It's cheaper to fix criteria than to fix code.

### Use Priority Correctly

| Priority | When to use |
|---|---|
| `critical` | Blockers, security fixes, anything on fire |
| `high` | Features you want shipped today |
| `normal` | This sprint's work |
| `low` | Nice-to-haves, backlog grooming |

### Trust the Gate, But Verify

The gate catches structural problems (missing files, failing tests, unverified criteria). It doesn't catch design errors (wrong approach, bad API shape). Your review matters — but it's a design review, not a "did they check all the boxes" review.

---

## Further Reading

- [docs/positioning/index.md](index.md) — Overview of both AM audiences
- [docs/HOWTO-KANBAN.md](../HOWTO-KANBAN.md) — Kanban workflow guide
- [docs/GIT-WORKFLOW.md](../GIT-WORKFLOW.md) — Git integration details
- [messaging.md](../messaging.md) — For small-team founders (different audience, same platform)
