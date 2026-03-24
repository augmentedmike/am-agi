Read steps/4.md, docs/AGENT-LOOP.MD, and CLAUDE.md. Build two things:

**1. Claude Code invocation wrapper — `agent/src/claude/invoke.ts`**

A typed async function `invokeClaudeCode(prompt: string, iterDir: string): Promise<InvokeResult>` that:
- Runs: `claude --dangerously-skip-permissions -p <prompt> --output-format json`
- Streams stdout to `<iterDir>/output.json`
- Parses the JSON output and extracts the agent log text
- Writes the log text to `<iterDir>/agent.log`
- Returns `{ success: boolean, log: string, outputPath: string }`
- On non-zero exit: returns success=false with stderr captured in log, does not throw

**2. Git commit helper — `agent/src/git/commit.ts`**

Two exported functions:

`commitIteration(cardId: string, iterN: number, summary: string): Promise<void>`
- Runs: `git add -A && git commit -m "<cardId>/iter-<n>: <summary>"`
- Extracts the one-line summary from the agent log if not provided

`shipCard(cardId: string, description: string): Promise<void>`
- Squashes all iteration commits: `git reset $(git merge-base HEAD origin/main)`
- Commits: `git commit -m "<cardId>: <description>"`
- Rebases: `git fetch origin && git rebase origin/main`
- Merges: `git checkout main && git merge --ff-only <cardId>`
- Pushes: `git push origin main`
- Cleans up: `git worktree remove ../am-<cardId> && git branch -d <cardId>`
- Each step is its own named function — if any step fails it throws with the step name and stderr

Code quality:
- All shell commands go through a single `exec(cmd: string): Promise<ExecResult>` utility
- ExecResult type: `{ stdout: string, stderr: string, exitCode: number }`
- exec throws only on unexpected errors; non-zero exit codes are returned, not thrown
- No hardcoded paths — workDir and repoRoot are parameters
- Commit messages are validated: non-empty, under 72 chars for subject line

Definition of done:
- `bun test` passes for: output JSON parsing, log extraction, commit message formatting, shipCard step sequencing
- invokeClaudeCode writes output.json and agent.log to the iter dir
- shipCard on a test branch with 3 iteration commits produces exactly one commit on main