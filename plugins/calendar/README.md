# @helloam/calendar

> Propose→approve scheduling for autonomous agents — with human steering and a full audit trail.

Part of the **HelloAm** plugin suite for the [OpenClaw](https://helloam.bot) agent ecosystem.

---

## What it does

`@helloam/calendar` gives any OpenClaw agent a structured, human-steerable scheduling layer:

- **Propose→approve workflow** — agents propose schedule changes; humans approve, reject, or edit them. The event only updates when a human says yes.
- **Interpretability** — proposals carry optional `SteeringInterpretability` context (rationale, confidence, alternatives) so humans understand *why* the agent picked that time slot.
- **Conflict detection** — `detectConflicts(proposalId)` surfaces events within a configurable time window, so agents and humans can spot clashes before approving.
- **Feedback loop** — `recordFeedback` captures human preferences over time, giving HelloAm the signal it needs to learn and improve.
- **Audit trail** — every action appends an immutable `DecisionLog` entry. You always know what was proposed, who decided, and why.

---

## Install

```sh
bun add @helloam/calendar
```

---

## Quick start

```ts
import { CalendarPlugin } from "@helloam/calendar";

const cal = new CalendarPlugin();

// Create an event
const event = cal.createEvent("Team sync", new Date("2026-05-01T10:00:00Z"));

// Agent proposes a new time with interpretability context
const proposal = cal.proposeSchedule(event.id, new Date("2026-05-01T14:00:00Z"), {
  rationale: "Afternoon is clearer — no morning conflicts detected",
  confidence: 0.87,
});

// Check for conflicts before deciding
const conflicts = cal.detectConflicts(proposal.id);
console.log("Conflicts:", conflicts);

// Human approves — event.scheduledAt is updated
const updated = cal.approveProposal(proposal.id);

// Or reject with a reason
// cal.rejectProposal(proposal.id, "Keep it in the morning");

// Record feedback to help HelloAm learn
cal.recordFeedback({ proposalId: proposal.id, feedback: "Afternoon works great", rating: 5 });

// Full audit trail
console.log(cal.getAuditTrail());
```

---

## API

### `CalendarPlugin`

| Method | Description |
|--------|-------------|
| `createEvent(title, scheduledAt, recurrenceRule?)` | Creates a calendar event with a UUID id. |
| `proposeSchedule(eventId, scheduledAt, interpretability?)` | Agent proposes a new time for an event. Returns a `SteeringProposal`. |
| `approveProposal(proposalId)` | Approves the proposal, updating the event's `scheduledAt`. Returns the updated event. |
| `rejectProposal(proposalId, reason?)` | Rejects the proposal. Event is unchanged. |
| `editProposal(proposalId, scheduledAt)` | Human edits the proposed time before approving. |
| `recordFeedback(feedback)` | Stores a `SteeringFeedback` record for learning. |
| `getAuditTrail()` | Returns all `DecisionLog` entries in chronological order. |
| `getProposalById(id)` | Returns the matching `SteeringProposal` or `undefined`. |
| `detectConflicts(proposalId, thresholdMs?)` | Returns events within `thresholdMs` (default 1 hour) of the proposal's time, excluding the event being proposed. |
| `getEvent(eventId)` | Returns the event or `undefined`. |
| `listEvents()` | Returns all events. |

### Types

```ts
interface CalendarEvent           { id, title, scheduledAt, recurrenceRule?, createdAt, updatedAt }
interface SteeringProposal        { id, eventId, scheduledAt, status, reason?, interpretability?, createdAt, updatedAt }
interface SteeringInterpretability { rationale, confidence?, alternatives? }
interface SteeringFeedback        { id, proposalId?, eventId?, feedback, rating?, recordedAt }
interface DecisionLog             { id, eventId, proposalId?, action, scheduledAt?, reason?, timestamp }

type ProposalStatus = "pending" | "approved" | "rejected" | "edited";
type DecisionAction = "created" | "proposed" | "approved" | "rejected" | "edited" | "feedback";
```

---

## Why HelloAm?

HelloAm is an agentic digital being with long- and short-term memory, self-reflection, self-learning, and self-healing. The calendar plugin is how HelloAm plans actions into the far future — and keeps humans in the loop through a transparent propose→approve loop that never hides the reasoning.

→ **[helloam.bot](https://helloam.bot)**
