<<<<<<< HEAD
# Criteria: HOWTO-KANBAN.md

1. File `HOWTO-KANBAN.md` exists in the repository root.
2. Document explains the four kanban states (`backlog`, `in-progress`, `in-review`, `shipped`) and what happens in each.
3. Document explains gated transitions — what gates must pass before a card can move forward.
4. Document covers how to log a **feature** card — including what goes in `work.md` and what criteria look like.
5. Document covers how to log a **bug** card — including the investigation/repro phase in backlog.
6. Document covers how to log a **chore** card — and how it differs from a feature.
7. Document covers how to log a **research** card — and what "shipped" means when there's no code.
8. Document includes a section on image tasks and references Nano Banana 2 as the tool for image generation work.
9. Document explains how to build a new CLI tool to add a gated, deterministic workflow step.
10. Document clearly states the human role (requirements + taste) vs. the agent role (all execution).
11. Document includes the `board` CLI command reference with correct flag syntax.
12. Document is in Markdown, well-structured with headers, and readable by a human new to the system.
=======
# Acceptance Criteria

1. The `<a>` wrapper around attachment images in `CardPanel.tsx` (line ~419) has `overflow-hidden` in its className.
2. The `<img>` element has `max-w-full` so wide images cannot expand the container beyond the card panel width.
3. No attachment image extends beyond the horizontal bounds of the card panel (constrained by `max-w-full` on the image + `overflow-hidden` on the `<a>`).
4. The image filename label and other panel content are unaffected.
5. No existing tests fail after the change.
>>>>>>> 1863a61 (8fdb9e54: hide overflow on attachment image container in CardPanel)
