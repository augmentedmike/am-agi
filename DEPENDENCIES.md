# Dependencies

All runtime dependencies for AM. Keep this file up to date when adding or removing anything.

---

## Runtime (all platforms)

<!-- Update version column after each upgrade. Pinned = exact; ^x = semver minor OK -->

| Dependency | Pinned | Current | Purpose | Install |
|---|---|---|---|---|
| [Node.js](https://nodejs.org) | 24 LTS | **v24.14.0** | Board web app (better-sqlite3 requires Node) | see per-platform |
| [Bun](https://bun.sh) | **1.3.6** (pinned in `.bun-version`) | **1.3.6** | Agent loop, tests, TypeScript scripts | see per-platform |
| [Git](https://git-scm.com) | 2.x | **2.50.1** | Worktree isolation, commit per iteration | see per-platform |
| [Claude CLI](https://github.com/anthropics/claude-code) | latest | **2.1.83** | Agent invocation (`claude -p ...`) | `npm install -g @anthropic-ai/claude-code` |

**Anthropic account required** — Claude Max subscription ($20–$200/mo). No other inference provider is currently supported.

---

## npm packages (board app)

Managed by `board/package.json`. Install with `cd board && npm install`.

| Package | Version | Purpose |
|---|---|---|
| `next` | **16.1.1** | Web framework |
| `react` | **19.2.3** | UI |
| `better-sqlite3` | **^12.8.0** | SQLite — requires Node, cannot run under Bun |
| `drizzle-orm` | **^0.45.1** | ORM / query builder |
| `drizzle-kit` | **^0.31.10** | Schema migrations (dev) |
| `zod` | **^4.3.6** | API input validation |
| `react-markdown` | **^10.1.0** | Markdown rendering in card panel |
| `tailwindcss` | **^4** | Styling |
| `sqlite-vec` | **^0.1.7** | Vector similarity (knowledge store) |
| `typescript` | **5.9.3** | Type checking (dev) |

---

## macOS

| Dependency | Recommended install |
|---|---|
| Node.js 24 | `brew install node@24` |
| Bun | `curl -fsSL https://bun.sh/install \| bash` |
| Git | pre-installed or `brew install git` |
| Claude CLI | `npm install -g @anthropic-ai/claude-code` |
| **Service manager** | **macOS LaunchAgents** — run `bash install.sh` |

---

## Linux

| Dependency | Recommended install |
|---|---|
| Node.js 24 | via nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh \| bash && nvm install 24` |
| Bun | `curl -fsSL https://bun.sh/install \| bash` |
| Git | `apt install git` / `dnf install git` / `apk add git` |
| Claude CLI | `npm install -g @anthropic-ai/claude-code` |
| **Service manager** | auto-detected — run `bash install.sh` |

### Supported init systems (auto-detected)

| Init | Distros | Notes |
|---|---|---|
| **systemd** | Ubuntu, Debian, Fedora, Arch, RHEL, most VPS | User units in `~/.config/systemd/user/` |
| **OpenRC** | Alpine, Gentoo, Artix-OpenRC | Run scripts in `~/.am/sv/` |
| **runit** | Void Linux, Artix-runit | Run scripts in `~/sv/` |
| **upstart** | Legacy Ubuntu < 15.04 | Conf files in `~/.init/` |
| **fallback** | Any other | `~/.am/launch.sh` sourced from `~/.profile` |

---

## Windows

| Dependency | Recommended install |
|---|---|
| Node.js 24 | `winget install OpenJS.NodeJS.LTS` |
| Bun | `powershell -c "irm bun.sh/install.ps1 \| iex"` |
| Git | `winget install Git.Git` |
| Claude CLI | `npm install -g @anthropic-ai/claude-code` |
| **Service manager** | **Task Scheduler** — run `.\launchagents\windows\install.ps1` |

Windows 10 1809+ required (winget). PowerShell 5.1+ required.

---

## Dev only (macOS/Linux)

| Tool | Purpose |
|---|---|
| `drizzle-kit` | DB schema push / generate (devDependency in board) |
| `bun test` | Test runner for agent loop and board |
