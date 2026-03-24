Read steps/5.md and CLAUDE.md. Scaffold a full-stack Next.js Kanban board application at `apps/board/` using the standard stack: Next.js 15, React 19, Tailwind 4, Bun, TypeScript, SQLite with Drizzle ORM, and a vector DB extension for the knowledge base.

**Scaffold the application with `new-next board` first, then implement the following:**

## Data Layer — `src/db/`

Schema (Drizzle):
- `cards` table: id, title, state (enum: backlog|in-progress|in-review|shipped), priority (enum: critical|high|normal|low), attachments (JSON array), work_log (JSON array of {timestamp, message}), created_at, updated_at
- `iterations` table: card_id, iteration_number, log_text, commit_sha, created_at
- `knowledge` table: id, content (text), embedding (vector), source, card_id (nullable), created_at

Use `better-sqlite3` with `sqlite-vss` or `sqlite-vec` for the vector extension. All queries go through Drizzle — no raw SQL except for vector similarity search where Drizzle cannot express it.

## API Layer — `src/app/api/`

Next.js route handlers (typed with Zod validation on all inputs):
- `GET /api/cards` — list cards, supports ?state= and ?priority= filters
- `POST /api/cards` — create card
- `GET /api/cards/[id]` — get card with full work log
- `PATCH /api/cards/[id]` — update title, priority, append work log entry, add attachment
- `POST /api/cards/[id]/move` — request state transition (validated by gate worker, not blindly applied)
- `POST /api/cards/[id]/archive` — move to archived state
- `GET /api/knowledge/search` — vector similarity search over knowledge base, ?q=<query>&limit=<n>
- `POST /api/knowledge` — store embedding + content

WebSocket endpoint at `/api/ws` — broadcast card state changes to all connected clients.

## Gate Worker — `src/worker/gates.ts`

A server-side module (not a route handler) that the move route calls before applying any transition:
- backlog → in-progress: criteria.md attached and file exists and is non-empty, todo.md attached and file exists and is non-empty
- in-progress → in-review: todo.md has no unchecked items (no lines matching `- [ ]`)
- in-review → shipped: Run `bun test` in the card workDir — must exit 0; iter/<n>/agent.log exists; every criterion in criteria.md has a `✓` or `[pass]` entry in the latest agent.log
- in-review → in-progress: always allowed
- Returns `{ allowed: boolean, failures: string[] }`

## Frontend — `src/app/`

Board view (`/`):
- Four columns: backlog, in-progress, in-review, shipped
- Cards show: title, priority badge, iteration count, last work log entry
- Priority badge colors: critical=red, high=orange, normal=gray, low=blue
- Real-time updates via WebSocket

Card detail view (`/cards/[id]`):
- Full work log timeline
- Iteration history with links to agent.log content
- Attachment list
- Criteria checklist (parsed from criteria.md if attached)

Code quality:
- db/ is a pure data layer — no HTTP, no Next.js imports
- api/ route handlers are thin: validate input → call db/ function → return response
- All Zod schemas colocated with their route in a `schema.ts` file
- No `any` types
- Tailwind classes only — no inline styles, no CSS modules
- All db operations tested with an in-memory SQLite instance

Definition of done:
- `bun run dev` starts the board with no errors
- All four columns render with mock seed data
- Creating a card via POST /api/cards appears on the board in real time
- Moving a card via POST /api/cards/[id]/move is rejected with 422 when gate conditions not met
- Vector search returns results ranked by cosine similarity
- `bun test` passes for: all route handlers, gate worker logic, schema validation