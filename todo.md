# Todo: HelloAm OpenClaw Plugins

## Kanban Plugin
- [x] Create `plugins/kanban/package.json` with name `@helloam/kanban`, version `0.0.1`
- [x] Create `plugins/kanban/tsconfig.json`
- [x] Create `plugins/kanban/src/index.ts` with `KanbanPlugin` class and all exports
- [x] Implement `createCard()`: UUID id, state=backlog, DecisionLog entry
- [x] Implement `moveCard()`: gate-enforced transitions, throws on invalid, DecisionLog entry
- [x] Implement `requestSteering()`: store SteeringRequest, DecisionLog entry
- [x] Implement `getDecisionLogs(cardId?)`: all logs or filtered by card
- [x] Create `plugins/kanban/src/index.test.ts` with full coverage
- [x] Create `plugins/kanban/README.md` with HelloAm branding and helloam.bot link

## Calendar Plugin
- [x] Create `plugins/calendar/package.json` with name `@helloam/calendar`, version `0.0.1`
- [x] Create `plugins/calendar/tsconfig.json`
- [x] Create `plugins/calendar/src/index.ts` with `CalendarPlugin` class and all exports
- [x] Implement `createEvent()`: UUID id, recurrenceRule, DecisionLog entry
- [x] Implement `proposeSchedule()`: store proposal + interpretability, DecisionLog entry
- [x] Implement `approveProposal()`: update event scheduledAt, DecisionLog entry
- [x] Implement `rejectProposal()`: mark rejected, DecisionLog entry
- [x] Implement `editProposal()`: update proposal scheduledAt, DecisionLog entry
- [x] Implement `recordFeedback()`: store SteeringFeedback
- [x] Implement `getAuditTrail()`: all DecisionLog entries in chronological order
- [x] Implement `getProposalById()`: return proposal by id or undefined
- [x] Implement `detectConflicts()`: events within threshold of proposed time
- [x] Create `plugins/calendar/src/index.test.ts` with full coverage
- [x] Create `plugins/calendar/README.md` with HelloAm branding and helloam.bot link

## Verify
- [x] `bun test plugins/kanban/src/index.test.ts` exits 0
- [x] `bun test plugins/calendar/src/index.test.ts` exits 0
- [x] 45 tests, 0 failures
