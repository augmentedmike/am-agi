# Card: in the new card button - remove the [brackets] in the label (47618de7-4559-4e04-a04a-71310227f538)
State: in-review
Priority: normal

## Instructions
You are working a card in the IN-REVIEW column. Your job is adversarial: assume the implementation is wrong and try to prove it.

1. Read context:
   - criteria.md — the acceptance criteria to verify
   - The latest iter/<n>/agent.log — prior verification attempts

2. Verify each criterion independently:
   - Do not assume the implementation works. Read the code, run commands, check outputs.
   - For CODE tasks: run `bun test` and check exit code.
   - If docs/CODE_QUALITY.md exists: scan the implementation against its rules. Flag any violations.

3. Write iter/<n+1>/agent.log with one line per criterion:
   - Pass: `✓ <criterion text>`
   - Fail: `✗ <criterion text>: <specific reason it failed>`

4. If ALL criteria pass:
   `board move <id> shipped`

5. If ANY criterion fails:
   `board move <id> in-progress --log "<concise summary of what failed and why>"`
   Do not attempt to fix the failures here — that is in-progress work.