# Dev Notes — 0.0.14

**Theme:** Chat-first workflow, live streaming, project context

---

## What Shipped

### Chat System
Full chat panel wired to a Haiku agent via the dispatcher:
- Slide-out panel with WebSocket for instant updates
- Ack-first pattern: posts a random acknowledgment (20 variations) immediately, then streams live content from Claude as it runs
- Streaming uses `--output-format stream-json --verbose` — assistant text and tool calls appear in real-time as the agent works
- Final `CHAT_RESPONSE:` line replaces the stream content when done
- Chat icon pulses violet when there are unread messages and the panel is closed
- Auto-scroll to bottom on new messages; shows sticky "New messages ↓" button if user has scrolled up
- Keyboard shortcut hint above textarea: `Enter` = new line, `Shift ⏎` = send

### WebSocket Server
Replaced SSE with a dedicated Bun WebSocket server (`bin/ws-server`, port 4201):
- `POST /broadcast` fans out to all connected clients
- `GET /health` reports client count
- Board API POSTs to ws-server; browser connects directly via WS
- Auto-reconnect on both server and client side
- LaunchAgent `am.ws-server.plist` added; install scripts updated for macOS, Linux, Windows

### Settings System
Key-value settings table in SQLite:
- `GET /api/settings` returns all settings (github_token masked as `***`)
- `PATCH /api/settings` bulk-updates
- `board settings list/get/set` CLI
- `GlobalSettings` modal accessible from ProjectSettings gear icon
- Defaults: `github_username`, `github_token`, `github_email`, `workspaces_dir`

### Projects Context
Lifted project state to a top-level React context (`ProjectsContext`):
- `usePathname()` derives `selectedProjectId` from URL — no prop drilling
- Listens for `project_created` / `project_updated` WS events — dropdown updates live, no refresh needed
- `switchProject(id)` used everywhere instead of direct `router.push`
- Projects API now broadcasts `project_created` on POST

### Project & Card CLI Additions
- `board project create --name <name>` — local git init, no GitHub required
- `board project create --name <name> --repo <url>` — clone from GitHub
- `board project create --name <name> --repo-dir <path>` — existing local dir
- `board create --project-id <id> --parent-id <id>` — epic/child card hierarchy
- `parentId` wired through API schema → DB → response

### Chat Links
- `[[card:UUID]]` → pink clickable badge (existing)
- `[[project:UUID]]` → violet clickable badge, shows project name, switches board on click

### Dispatcher Changes
- Chat runs on its own 500ms loop (was sharing 5s card loop)
- System prompt: project creation flow, task breakdown rule (always epic + 3–7 children), `[[project:UUID]]` requirement in responses
- Separate try/catch for card cycle and chat cycle — one failure doesn't block the other

---

## Bugs Fixed

| Bug | Fix |
|---|---|
| `stream-json` requires `--verbose` | Added `--verbose` to args when streaming |
| Chat ack empty (stream-json error silently failed) | Fixed by `--verbose`; ack now shows real content |
| Project dropdown didn't update without refresh | ProjectsContext + WS `project_created` event |
| Chat agent created card on wrong board | `--project-id` flag now wired through API |
| Chat polling too slow (5s) | Dedicated 500ms chat loop |
| `"…"` ack too terse | 20 random acknowledgment phrases |

---

## Architecture Notes

- `ws-store.ts` is now a thin HTTP client to `bin/ws-server` — no in-process state
- `invoke-claude.ts` now supports `onEvent` callback for stream-json parsing; extracts result text and usage from the `result` event
- `ProjectsContext` owns all project state; `BoardClient` consumes it via `useProjects()`
- Chat message lifecycle: `pending` → `processing` (ack posted) → live stream patches → `done` (final response)

---

## What's Next

- Agent loop output streamed into card detail panel (live log view)
- Project-scoped card dispatch (agents only pick up cards for their project)
- `[[card:UUID]]` should show card title, not just ID prefix
- GitHub token validation on settings save
- Notifications / mentions in chat
