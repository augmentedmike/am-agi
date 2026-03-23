# Kanban

The kanban is the agent's brain. It holds all working state for a card — where it is, what was done, what comes next, what docs are attached. The agent reads and writes it. It is not a UI.

## State Machine

Cards move through four states. Transitions are gated — a card cannot skip states or move backward without meeting exit criteria.

```
backlog → in-progress → in-review → shipped
```

### States

**backlog**
The card exists but work has not started. The agent uses this phase for research and prep — reading docs, exploring the codebase, writing criteria.md. A card leaves backlog when criteria.md exists and the agent has enough context to begin.

**in-progress**
Active implementation. The agent is writing code, creating files, making changes. A card leaves in-progress when all criteria in criteria.md have a corresponding implementation and the agent believes the work is complete.

**in-review**
Verification phase. The agent runs tests, checks each criterion in criteria.md, and confirms nothing regressed. A card leaves in-review only when all criteria pass. If verification fails, the agent notes the failure in the work log and moves the card back to in-progress.

**shipped**
Work is verified and complete. Triggers the post hook (commit, rebase, merge). Terminal state — cards do not leave shipped.

### Gated Transitions

| From | To | Gate |
|---|---|---|
| backlog | in-progress | criteria.md written, context gathered |
| in-progress | in-review | all criteria have implementation |
| in-review | shipped | all criteria verified, tests pass |
| in-review | in-progress | verification failed — logged, work resumes |

Movement is not built into the kanban. The agent decides when gates are met and moves cards via the `board` CLI.

## Card Format

```markdown
### <id>: <title>
**state:** backlog | in-progress | in-review | shipped
**priority:** critical | high | normal | low
**attachments:** [list of doc/file paths relevant to this card]

**work log:**
- <timestamp> — <what was done or learned>
```

## Priorities

| Priority | Meaning |
|---|---|
| **critical** | Blocks other cards or a hard deadline. Do first, do now. |
| **high** | Important, do before normal work. |
| **normal** | Default. Do in order. |
| **low** | Do when nothing else is waiting. |

The agent works the highest-priority in-progress card first. If nothing is in-progress, it pulls the highest-priority backlog card.

## Work Log

Every state transition and every meaningful action gets a work log entry on the card. The log is append-only — entries are never edited or removed. It is the audit trail of what the agent did and why.

```markdown
- 2026-03-23T14:02Z — moved to in-progress, criteria.md written
- 2026-03-23T14:18Z — scaffolded data model in pkg/model/
- 2026-03-23T14:35Z — moved to in-review
- 2026-03-23T14:41Z — TestScoreCalc failed, missing edge case for zero input
- 2026-03-23T14:43Z — moved back to in-progress
- 2026-03-23T14:50Z — fixed zero-input edge case, tests pass
- 2026-03-23T14:51Z — moved to shipped
```

## Attachments

Attachments are file or doc paths the agent pins to a card for reference — specs, prior art, API docs, relevant source files. They are not copied; the path is the reference.

```markdown
**attachments:**
- docs/api-spec.md
- pkg/model/score.go
- https://...
```

The agent adds attachments when it discovers relevant context during backlog research. Attachments travel with the card through all states.
