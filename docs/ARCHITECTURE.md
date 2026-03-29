# AM System Architecture

A complete map of what exists, what each piece does, and how everything fits together.

---

## The Big Picture

AM is an agent-driven development system. A human puts work on a Kanban board. An agent loop picks up the work, executes it column by column, and the board's gate worker enforces quality before anything advances. The human watches. The agent works.

```
Human → Board (card) → Runner → Agent Loop → Gate Worker → Board (state advance)
```

No step happens without the one before it completing. No card advances without verification. No agent decides its own work is done.

---

## Repository Layout

```
am/
├── agent/                  # The agent runtime (Bun/TypeScript)
│   └── src/
│       ├── loop/           # One-shot Claude invocation
│       ├── runner/         # Loop orchestration + iteration commits
│       └── git/            # Squash + ship helpers
├── apps/
│   └── board/              # Kanban board (Next.js + SQLite)
│       └── src/
│           ├── app/api/    # REST API routes
│           ├── components/ # React UI
│           ├── db/         # Drizzle ORM schema + queries
│           └── worker/     # Gate logic + column prompts
├── scripts/
│   ├── board.ts            # Board CLI (bun script)
│   └── new-next.ts         # Next.js workspace scaffolder
├── steps/                  # Step-by-step build guide (1-9+)
├── docs/                   # Architecture, process docs
├── init.sh                 # Session bootstrap (adds bin/ to PATH)
└── bin/                    # Runtime CLI symlinks (gitignored)
```

---

## Components

### 1. The Agent Loop (`agent/src/loop/`)

**What it does:** Invokes the Claude CLI once with a prompt and a working directory. Returns the result.

**Key file:** `invoke-claude.ts`
- Takes `workDir`, `prompt`, and optional `InvokeOptions` (`claudePath`, `systemPrompt`)
- Spawns `claude --dangerously-skip-permissions -p <prompt> --output-format json`
- Strips `CLAUDECODE` and `CLAUDE_CODE_ENTRYPOINT` env vars before spawning — prevents nested session auth failures
- Streams stdout to the parent process while collecting it for return
- If `systemPrompt` is provided, passes `--system-prompt <value>` to the CLI

**Key file:** `runIteration.ts` (in loop/index.ts)
- Reads `work.md` from `workDir` as the prompt
- Calls `invokeClaude`
- Returns `{ result, exitCode }`

### 2. The Runner (`agent/src/runner/`)

**What it does:** Runs the agent loop repeatedly until Claude outputs `"DONE"` or hits `maxIterations`. After each iteration, writes `iter/<n>/agent.log` and commits.

**Key file:** `index.ts → runLoop(workDir, maxIterations = 10)`
- Loop: call `runIteration` → write agent.log → `git add -A && git commit "iter: <summary>"` → check for DONE
- On DONE: `process.exit(0)`
- On maxIterations: `process.exit(1)`

**Git helpers:** `agent/src/git/commit.ts`
- `stepSquash`: squashes all iteration commits into one, collecting their messages as the squash body
- Used in the ship script

### 3. The Board (`apps/board/`)

**What it does:** A Next.js app backed by SQLite (via Drizzle ORM). Exposes a REST API for cards, provides a Kanban UI, and enforces state machine transitions through a gate worker.

#### Schema (`src/db/schema.ts`)

```
cards
  id          TEXT PRIMARY KEY
  title       TEXT NOT NULL
  state       TEXT  -- backlog | in-progress | in-review | shipped
  priority    TEXT  -- critical | high | normal | low
  attachments TEXT  -- JSON array of {path, name}
  work_log    TEXT  -- JSON array of {timestamp, message}
  work_dir    TEXT  -- absolute path to card's git worktree
  archived    INTEGER -- boolean, 0/1
  created_at  TEXT
  updated_at  TEXT

iterations
  id               TEXT PRIMARY KEY
  card_id          TEXT REFERENCES cards(id)
  iteration_number INTEGER
  log_text         TEXT
  commit_sha       TEXT
  created_at       TEXT

knowledge
  id        TEXT PRIMARY KEY
  content   TEXT
  embedding BLOB   -- Float32Array, for vector search
  source    TEXT
  card_id   TEXT
  created_at TEXT
```

#### API Routes (`src/app/api/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cards` | List cards (filter by state, priority) |
| POST | `/api/cards` | Create card |
| GET | `/api/cards/:id` | Get card |
| PATCH | `/api/cards/:id` | Update title, priority, workLog, attachments, workDir |
| POST | `/api/cards/:id/move` | Transition state — runs gate worker first |
| POST | `/api/cards/:id/archive` | Set `archived = true` |
| POST | `/api/knowledge` | Store knowledge with embedding |
| GET | `/api/knowledge/search` | Cosine similarity search |

#### Gate Worker (`src/worker/gates.ts`)

**What it does:** Deterministic verification before any card state transition. Called by the move API route. Never called by the agent directly.

**Transitions and checks:**

`backlog → in-progress`:
- `criteria.md` attached, exists, non-empty, contains numbered criteria (`1. ...`)
- `research.md` attached, exists, non-empty
  - Code tasks (content contains `src/`): requires a file path
  - Non-code tasks: requires a URL or citation
- Card title non-empty

`in-progress → in-review`:
- `todo.md` has no unchecked items (`- [ ]`)
- If test files exist in workDir: `bun test` must exit 0

`in-review → shipped`:
- `iter/<n>/agent.log` exists with `✓ <criterion>` for every criterion in `criteria.md`
- `bun test` exits 0
- If `docs/CODE_QUALITY.md` exists: no "never do" violations in `git diff main...HEAD`

`in-review → in-progress`: always allowed (failure route).

#### Column Prompts (`src/worker/prompts.ts`)

Three exported constants — `BACKLOG_PROMPT`, `IN_PROGRESS_PROMPT`, `IN_REVIEW_PROMPT` — that define exactly what the agent should do when dispatched to a card in that column. These are the work descriptions injected into `work.md` before AM runs.

### 4. The Board CLI (`scripts/board.ts`)

**What it does:** The agent's only interface to card state. Talks to the board API. No direct DB access.

**Commands:**

```sh
board create --title <title> [--priority critical|high|normal|low] [--attach <path>...]
board move <id> <state>          # gate-enforced
board update <id> [--title <t>] [--priority <p>] [--log <msg>] [--attach <path>...] [--workdir <path>]
board show <id>
board search [--state <s>] [--priority <p>] [--text <q>] [--all]
board archive <id> [--reason <msg>]
```

`board move` is the critical one: the CLI makes the request, the gate worker runs server-side, and failures come back as a 422 with specific failure messages. The agent sees the failures and must address them.

`--workdir` on `board update` registers the card's git worktree path on the card. This enables gate checks that need to read the filesystem (test files, iter logs, criteria.md).

### 5. The Board UI (`apps/board/src/components/`)

**What it does:** A Kanban board in the browser. Dark zinc/glass aesthetic, full-height columns, collapsible Shipped column.

- `BoardClient.tsx` — viewport-height flex layout, fetches and distributes cards to columns
- `CardColumn.tsx` — individual column with sticky header, independent scroll, collapsible (Shipped only)
- `CardTile.tsx` — individual card tile: title, priority badge, card ID, glass treatment

### 6. Session Bootstrap (`init.sh`)

**What it does:** Run once per session with `source ./init.sh`. Copies `scripts/board.ts` → `bin/board` and `scripts/new-next.ts` → `bin/new-next`, adds `bin/` to `PATH`. Without this, no CLI commands work.

---

## The Kanban State Machine

```
backlog → in-progress → in-review → shipped
                    ↑_______________|  (failure route, always allowed)
```

Each transition is gated. The agent requests the move via `board move`. The gate worker runs. The move either succeeds or fails with specific reasons. The agent must address failures before retrying.

**Priority order within a state:** `critical → high → normal → low`

---

## Card Worktrees

Each card owns a git worktree for its entire lifespan:

```
am-<card-slug>/        ← git worktree, branch card/<card-slug>
  work.md              ← column prompt + card context
  criteria.md          ← numbered acceptance criteria
  research.md          ← code file references or external sources
  todo.md              ← flat checklist of steps
  iter/
    1/agent.log
    2/agent.log
    ...
```

**1 card = 1 worktree = 1 branch = 1 agent loop.**

The worktree path is stored on the card (`workDir`). The runner creates it on first dispatch, reuses it on re-dispatch (e.g. after in-review → in-progress failure routing).

The ship script runs inside the worktree:
1. Squash all iteration commits to one
2. Rebase onto origin/main
3. FF-merge to main
4. Push
5. Clean up worktree and branch

---

## How a Card Goes from Idea to Shipped

1. **Create** — `board create --title "..." --priority high` → card lands in `backlog`
2. **Dispatch (backlog)** — Runner writes `BACKLOG_PROMPT + card JSON` to `work.md`, runs AM
3. **Research** — AM reads codebase/web, writes `criteria.md` + `research.md` + `todo.md`, attaches them, calls `board move <id> in-progress`
4. **Gate check** — Worker verifies criteria.md, research.md, title → allows or rejects
5. **Dispatch (in-progress)** — Runner writes `IN_PROGRESS_PROMPT + card JSON` to `work.md`, runs AM
6. **Implementation** — AM works through `todo.md`, writes code, writes tests, calls `board move <id> in-review`
7. **Gate check** — Worker checks todo.md complete + bun test passes
8. **Dispatch (in-review)** — Runner writes `IN_REVIEW_PROMPT + card JSON` to `work.md`, runs AM
9. **Verification** — AM adversarially checks each criterion, writes `✓`/`✗` to agent.log
   - All pass → `board move <id> shipped` → gate verifies → card ships → ship script runs
   - Any fail → `board move <id> in-progress` → back to step 5

---

## Model Adapters

AM's agent loop supports swappable model backends through the `AgentAdapter` interface. All model invocation flows through an adapter — no provider-specific code touches `runIteration()` directly.

### `AgentAdapter` Interface (`agent/src/loop/adapter.ts`)

```ts
export interface AgentAdapter {
  readonly providerId: string;   // e.g. "claude", "deepseek"
  readonly modelId: string;      // e.g. "claude-sonnet-4-5", "deepseek-chat"
  invoke(
    workDir: string,
    prompt: string,
    options?: AdapterInvokeOptions,
  ): Promise<AdapterResult>;
}

export interface AdapterInvokeOptions {
  systemPrompt?: string;
  model?: string;
  mcpConfigPath?: string;
  onEvent?: (event: StreamEvent) => void;
  claudePath?: string;  // ClaudeAdapter only
}

export interface AdapterResult {
  exitCode: number;
  result: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
}
```

### Concrete Adapters

| Class | File | Description |
|---|---|---|
| `ClaudeAdapter` | `agent/src/loop/adapters/claude.ts` | Wraps the existing `invokeClaude()` subprocess. All existing behaviour (startup lock, auth detection, streaming, MCP config) is preserved. Default when no env vars are set. |
| `OpenAICompatibleAdapter` | `agent/src/loop/adapters/openai-compatible.ts` | Uses the `openai` npm client with a configurable `baseURL`. Covers DeepSeek, Qwen, Kimi K2, and any vLLM-hosted model. Configured via env vars. |

### Adapter Selection (`resolveAdapter`)

`resolveAdapter(env)` is the factory used by `runIteration()`. Selection logic:

1. **Default** — `ClaudeAdapter` (no env vars required)
2. **OpenAI-compatible** — when all three of `AM_PROVIDER`, `AM_BASE_URL`, and `AM_API_KEY` are set

| Env var | Description | Example |
|---|---|---|
| `AM_PROVIDER` | Provider identifier | `deepseek`, `qwen`, `kimi` |
| `AM_BASE_URL` | API base URL | `https://api.deepseek.com/v1` |
| `AM_API_KEY` | API key | `sk-...` |
| `AM_MODEL` | Model override (optional) | `deepseek-chat` |

### Using a Custom Adapter

`runIteration()` accepts an optional third argument:

```ts
import { runIteration } from "./agent/src/loop";
import { ClaudeAdapter } from "./agent/src/loop/adapters/claude";

const adapter = new ClaudeAdapter("claude-haiku-4-5");
const result = await runIteration(workDir, {}, adapter);
```

---

## Step Build History

| Step | Commit | What Was Built |
|------|--------|----------------|
| 2 | `1ed89a4` | Wiggum loop — one-shot Claude invocation, work.md in/out |
| 3 | `5757b4c` | Runner — loop + iteration commits + exit on DONE |
| 4 | `7ba5ade` | Claude invoker with JSON output, systemPrompt support, git squash helpers |
| 5 | `9d29e36` | Kanban board app — Next.js, SQLite, Drizzle, REST API, basic UI |
| 6 | `4b28cd3` | Gate worker (gates.ts) and enhanced gate tests |
| — | `308dc79` | Board CLI (scripts/board.ts), init.sh, leftover step 6 work |
| 7 | `c15b180` | Zinc/glass UI, collapsible Shipped column, archive via boolean flag |
| — | `e80cb5d` | Test fixes: async gates, archive assertion, migration DDL |
| 8 | `11c1edb` | Column prompts (prompts.ts), enhanced gate logic (research.md, code quality) |
