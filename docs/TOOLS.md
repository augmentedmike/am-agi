# Tools

## Board CLI

Your interface to the Kanban board. All process actions go through this.

```sh
board create --title <title> [--priority critical|high|normal|low] [--attach <path>...]
board move <id> <state>
board update <id> [--title <t>] [--priority <p>] [--log <msg>] [--attach <path>...] [--workdir <path>]
board show <id>
board search [--state <state>] [--priority <priority>] [--text <query>] [--all]
board archive <id> [--reason <msg>]
```

States: `backlog` → `in-progress` → `in-review` → `shipped`

`board move` is gate-enforced. If rejected, the specific failures are printed — address them and retry.

## Git

```sh
git add -A
git commit -m "<message>"
git status
git diff
git log --oneline
```

Commit after every meaningful unit of work.

## Bun

```sh
bun test              # run all tests
bun test <file>       # run specific test file
bun run dev           # start dev server (board app)
bun install           # install dependencies
```

## File System

Read, write, and edit files directly. All work happens inside your worktree.
