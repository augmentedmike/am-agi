# @helloam/kanban

> Gate-enforced Kanban for autonomous agents — with human steering and a full audit trail.

Part of the **HelloAm** plugin suite for the [OpenClaw](https://helloam.bot) agent ecosystem.

---

## What it does

`@helloam/kanban` gives any OpenClaw agent a structured, human-steerable work queue:

- **State machine** — cards move `backlog → in-progress → in-review → shipped`. Invalid jumps throw; you can't skip steps.
- **Steering requests** — a human (or another agent) can propose a state transition without bypassing the gate. Every request is logged.
- **Audit trail** — every `createCard`, `moveCard`, and `requestSteering` call appends an immutable `DecisionLog` entry. You always know who moved what and why.

---

## Install

```sh
bun add @helloam/kanban
```

---

## Quick start

```ts
import { KanbanPlugin } from "@helloam/kanban";

const board = new KanbanPlugin();

// Create a card
const card = board.createCard("Write blog post", "high");

// Move it through the pipeline
board.moveCard(card.id, "in-progress");
board.moveCard(card.id, "in-review");
board.moveCard(card.id, "shipped");

// Request human steering (won't forcibly move the card)
board.requestSteering(card.id, "in-review", "shipped", "All tests green — ready to ship");

// Inspect the audit trail
const logs = board.getDecisionLogs(card.id);
console.log(logs);
```

---

## API

### `KanbanPlugin`

| Method | Description |
|--------|-------------|
| `createCard(title, priority?)` | Creates a card with a UUID id in `backlog`. Priority defaults to `"normal"`. |
| `moveCard(cardId, to)` | Advances the card one step. Throws on invalid or backward transitions. |
| `requestSteering(cardId, from, to, reason?)` | Logs a human steering request without moving the card. |
| `getDecisionLogs(cardId?)` | Returns all logs, or only logs for the given card. |
| `getCard(cardId)` | Returns the card or `undefined`. |
| `listCards()` | Returns all cards. |

### Types

```ts
type KanbanState    = "backlog" | "in-progress" | "in-review" | "shipped";
type KanbanPriority = "critical" | "high" | "normal" | "low";

interface KanbanCard      { id, title, state, priority, createdAt, updatedAt }
interface SteeringRequest { id, cardId, from, to, reason?, requestedAt }
interface DecisionLog     { id, cardId, action, from?, to?, reason?, timestamp }
```

---

## Why HelloAm?

HelloAm is an agentic digital being with long- and short-term memory, self-reflection, self-learning, and self-healing. The kanban plugin is how HelloAm tracks its own work and lets humans steer it — without losing the audit trail that makes trust possible.

→ **[helloam.bot](https://helloam.bot)**
