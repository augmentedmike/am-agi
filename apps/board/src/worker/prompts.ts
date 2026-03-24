/**
 * prompts.ts — Column prompts for the AM agent loop.
 *
 * Each exported constant is the canonical work description for that kanban
 * column. When AM is dispatched to a card, it receives the column prompt as
 * its task description.
 */

export const BACKLOG_PROMPT = `
You are working a card in the BACKLOG column. Your job is to make the work concrete before anyone writes a line of code.

1. Read the card: run \`board show <id>\` to get the title, description, and any existing work log.

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
   - Format: \`1. <criterion>\`, \`2. <criterion>\`, etc.
   - Each criterion must be a testable, binary outcome (pass/fail, exists/missing).
   - Be specific. Vague criteria ("it works") will block review.

6. Write todo.md — a flat checklist derived from criteria.md:
   - Format: \`- [ ] <step>\` for each step needed to satisfy the criteria.

7. Attach all files to the card:
   \`board update <id> --attach research.md --attach criteria.md --attach todo.md\`

8. Attempt the gate:
   \`board move <id> in-progress\`
   - If the gate rejects, read the failure message, fix the specific issue, and retry.
`.trim();

export const IN_PROGRESS_PROMPT = `
You are working a card in the IN-PROGRESS column. Your job is to implement the work defined by criteria.md.

1. Read context:
   - \`board show <id>\` — card title and state
   - criteria.md — the acceptance criteria (numbered list)
   - research.md — file locations and references from backlog
   - todo.md — the current checklist of steps

2. Work through unchecked items in todo.md one at a time:
   - Implement the change.
   - For CODE tasks: write or update tests covering each criterion. Run \`bun test\` before marking any criterion done.
   - Check off the item in todo.md: change \`- [ ]\` to \`- [x]\`.
   - Rewrite todo.md after each item is completed.

3. When all items in todo.md are checked and tests pass:
   \`board move <id> in-review\`

4. If the gate rejects:
   - Read the failure message carefully.
   - Fix the specific issue (unchecked items, failing tests).
   - Retry the move.
`.trim();

export const IN_REVIEW_PROMPT = `
You are working a card in the IN-REVIEW column. Your job is adversarial: assume the implementation is wrong and try to prove it.

1. Read context:
   - criteria.md — the acceptance criteria to verify
   - The latest iter/<n>/agent.log — prior verification attempts

2. Verify each criterion independently:
   - Do not assume the implementation works. Read the code, run commands, check outputs.
   - For CODE tasks: run \`bun test\` and check exit code.
   - If docs/CODE_QUALITY.md exists: scan the implementation against its rules. Flag any violations.

3. Write iter/<n+1>/agent.log with one line per criterion:
   - Pass: \`✓ <criterion text>\`
   - Fail: \`✗ <criterion text>: <specific reason it failed>\`

4. If ALL criteria pass:
   \`board move <id> shipped\`

5. If ANY criterion fails:
   \`board move <id> in-progress --log "<concise summary of what failed and why>"\`
   Do not attempt to fix the failures here — that is in-progress work.
`.trim();
