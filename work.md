# Card: cards need to be able to accept drag and drop images to refer to in the card - add them as attachments when dragged and dropped into this box (368960c2-f882-4447-ba8e-245d6f6b8d52)
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