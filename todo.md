# Todo: Interpretability & Explainability for Both Plugins

## Calendar Plugin
- [x] Add `DecisionLog` interface to `plugins/calendar/src/index.ts` and export it
- [x] Add `private decisionLogs: DecisionLog[]` field to `CalendarPlugin`
- [x] Update `proposeSchedule()` signature to accept optional `interpretability?: SteeringInterpretability` param and store it; append a `DecisionLog` entry
- [x] Update `approveProposal()` to append a `DecisionLog` entry with `action: "approved"`
- [x] Update `rejectProposal()` to append a `DecisionLog` entry with `action: "rejected"`
- [x] Update `editProposal()` to append a `DecisionLog` entry with `action: "edited"`
- [x] Add `recordFeedback(feedback: SteeringFeedback): void` method
- [x] Add `getAuditTrail(): DecisionLog[]` method
- [x] Add `getProposalById(id: string): SteeringProposal | undefined` method
- [x] Add tests for new calendar methods in `plugins/calendar/src/index.test.ts`

## Kanban Plugin
- [x] Add `DecisionLog` interface to `plugins/kanban/src/index.ts` and export it
- [x] Add internal storage to `KanbanPlugin` (`private cards: Map<string, KanbanCard>`, `private decisionLogs: DecisionLog[]`)
- [x] Implement `createCard()`: generate UUID, store card, append `DecisionLog` entry
- [x] Implement `moveCard()`: validate card exists, update columnId, append `DecisionLog` entry with from/to metadata
- [x] Implement `requestSteering()`: store request, append `DecisionLog` entry
- [x] Add `getDecisionLogs(cardId?: string): DecisionLog[]` method
- [x] Create `plugins/kanban/src/index.test.ts` with full test coverage

## Verify
- [x] `bun test` passes for both plugins (47 tests, 0 failures)

## Board
- [x] Read card and classify task
- [x] Write research.md
- [x] Write criteria.md
- [x] Write todo.md
- [x] Attach files to card and stamp version
- [x] Move card to in-progress
- [x] Move card to in-review
