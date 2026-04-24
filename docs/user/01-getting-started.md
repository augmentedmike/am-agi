# Getting Started

## Requirements

- Git, Node.js, Bun
- macOS, Linux, or Windows (WSL or Git Bash for the bash scripts)
- **Default (Claude provider):** An Anthropic Claude subscription ($20–$200/mo) and the Claude CLI
- **Alternative providers:** Any OpenAI-compatible API (DeepSeek, Qwen, Ollama, etc.) — Claude CLI is not required. Set `AM_PROVIDER`, `AM_BASE_URL`, and `AM_API_KEY` environment variables before running the installer.

The installers below will handle Node.js, Bun, and Git if they're missing. Claude CLI is installed automatically unless `AM_PROVIDER` is set to a non-`"claude"` value.

---

## Install

### macOS

```bash
git clone https://github.com/augmentedmike/am-agi.git am
cd am
bash launchagents/install.sh
claude /login
```

Installs LaunchAgents — services start on login and restart on crash.

### Linux

```bash
git clone https://github.com/augmentedmike/am-agi.git am
cd am
bash launchagents/linux/install.sh
claude /login
```

Detects your init system (systemd, OpenRC, runit, upstart) and installs the appropriate service.

### Windows

```powershell
git clone https://github.com/augmentedmike/am-agi.git am
cd am
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\launchagents\windows\install.ps1
claude /login
```

Installs Task Scheduler tasks that start on login and restart on crash.

### Using an alternative provider

To skip Claude CLI installation and use a different model provider, set the env vars before running the installer:

```bash
export AM_PROVIDER=deepseek
export AM_BASE_URL=https://api.deepseek.com/v1
export AM_API_KEY=sk-your-key
bash install.sh   # or the platform-specific installer
```

The onboarding wizard will prompt for API key verification instead of Anthropic login.

---

## What the installer does

All three installers:
1. Install Node.js, Bun, Git, and Claude CLI if missing (Claude CLI is skipped when `AM_PROVIDER` is set to an alternative provider)
2. Install board app dependencies
3. Register and start two services:
   - **am-board** — Kanban web UI at `http://localhost:4200`
   - **am-dispatcher** — agent loop that picks up cards and runs AM

After install, open `http://localhost:4200`.

---

## Bootstrap (every session)

Every terminal session that will run AM commands needs the CLI tools in `PATH`:

```bash
source ./init.sh
```

This copies `scripts/board.ts` → `bin/board` and adds `bin/` to `PATH`. Without it, no CLI commands work.

---

## Your first project

There are two ways to create your first project:

**Option A — OnboardingWizard (recommended for new users)**

Open `http://localhost:4200` on first visit. The OnboardingWizard walks you through naming your project, picking a template, and creating your first card.

**Option B — CLI with `new-project`**

```sh
new-project my-app --template next-app
```

Available templates: `blank`, `bun-lib`, `next-app`. The command scaffolds the workspace and opens the board.

---

## Your first card

1. Create a card:
   ```sh
   board create --title "Research: what is AM?" --priority normal
   ```

2. Check what you created:
   ```sh
   board show <id>
   ```
   The `id` is printed when you run `board create`.

3. Watch the board at `http://localhost:4200` — the dispatcher will pick it up within 5 seconds and start working it.

4. Follow the work in the board UI or via:
   ```sh
   board search --state in-progress
   ```

---

## File layout after install

```
am/
├── bin/              # CLI scripts (added to PATH by init.sh)
├── docs/             # System documentation
├── workspaces/
│   ├── memory/       # ST and LT memory stores
│   └── vault/        # Encrypted secrets
├── board/            # Kanban card files (.qmd)
├── init.sh           # Session bootstrap
└── worktrees/        # Per-card git worktrees (created at runtime)
```

---

## Next steps

- [Core Concepts](02-core-concepts.md) — understand the three pillars
- [Kanban & Cards](03-kanban-cards.md) — how tasks flow through the system
- [Writing Good Work](09-writing-good-work.md) — how to write requirements AM can execute
