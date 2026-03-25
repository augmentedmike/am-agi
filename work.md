# Card: If I dont change to [critical high normal low] then its defaulted to AI - but your backlog prompt needs to inject the status if set to AI so the agent loop can detect and select the proper priority tag (53db86e1-fbbc-4dce-9442-2ac246afdb31)
State: backlog
Priority: normal

## Instructions
You are working a card in the BACKLOG column. Your job is to make the work concrete before anyone writes a line of code.

1. Read the card: run `board show <id>` to get the title, description, and any existing work log.

2. Classify the task:
   - CODE TASK: the card involves writing, editing, or deleting source files.
   - NON-CODE TASK: the card involves research, documentation, design, or other non-implementation work.

3. For CODE tasks — write research.md:
   - Read the relevant source files using Read/Glob/Grep tools.
   - Identify the specific files and line numbers that need to change.
   - research.md must include at least one file path reference (e.g. src/worker/gates.ts:42).

4. For NON-CODE tasks — write research.md:
   - Use web search to gather relevant sources, prior art, and key findings.
   - research.md must include at least one URL (http://... or https://...) or citation.

5. Write criteria.md — a numbered list of acceptance criteria:
   - Format: `1. <criterion>`, `2. <criterion>`, etc.
   - Each criterion must be a testable, binary outcome (pass/fail, exists/missing).
   - Be specific. Vague criteria ("it works") will block review.

6. Write todo.md — a flat checklist derived from criteria.md:
   - Format: `- [ ] <step>` for each step needed to satisfy the criteria.

7. Attach all files to the card:
   `board update <id> --attach research.md --attach criteria.md --attach todo.md`

8. Attempt the gate:
   `board move <id> in-progress`
   - If the gate rejects, read the failure message, fix the specific issue, and retry.