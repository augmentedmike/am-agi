#!/usr/bin/env bash
# install.sh — set up AM on macOS or Linux
#
# One-command install (clones + sets up everything):
#   curl -fsSL https://raw.githubusercontent.com/augmentedmike/am-agi/main/install.sh | bash
#
# Or from a cloned repo:
#   ./install.sh
#
# What it does:
#   1. Clones the repo if not already present
#   2. Installs Git, Node.js 24, Bun, Claude CLI (if missing)
#   3. Installs board npm dependencies and builds
#   4. Initialises bin/ and workspaces
#   5. Registers background services (LaunchAgents on macOS, systemd/fallback on Linux)
#   6. Creates board.db with full schema
#   7. Opens http://localhost:4220

set -e

PROD_PORT=4220
WS_PORT=4201

main() {
  # ── Locate or clone repo ────────────────────────────────────────────────────

  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"

  if [ -f "$SCRIPT_DIR/board/package.json" ] && [ -f "$SCRIPT_DIR/init.sh" ]; then
    REPO="$SCRIPT_DIR"
  elif [ -f "./board/package.json" ] && [ -f "./init.sh" ]; then
    REPO="$(pwd)"
  else
    local DEST="${AM_INSTALL_DIR:-$HOME/am}"
    if [ -d "$DEST/.git" ]; then
      echo "Updating existing repo at $DEST..."
      git -C "$DEST" pull --ff-only origin main 2>/dev/null || true
    else
      echo "Cloning AM into $DEST..."
      git clone https://github.com/augmentedmike/am-agi.git "$DEST"
    fi
    REPO="$DEST"
    cd "$REPO"
  fi

  echo "AM install"
  echo "Repo: $REPO"
  echo ""

  # ── Platform ──────────────────────────────────────────────────────────────────

  local OS PLATFORM
  OS="$(uname -s)"
  case "$OS" in
    Darwin) PLATFORM="mac" ;;
    Linux)  PLATFORM="linux" ;;
    *)
      echo "ERROR: unsupported platform: $OS"
      echo "Windows users: run install.ps1 instead"
      exit 1
      ;;
  esac
  echo "Platform: $PLATFORM"
  echo ""

  # ── 1. Git ──────────────────────────────────────────────────────────────────

  if ! command -v git >/dev/null 2>&1; then
    echo "Installing git..."
    if [ "$PLATFORM" = "mac" ]; then
      xcode-select --install 2>/dev/null || true
      echo "  Complete the Xcode CLI install prompt then re-run."
      exit 1
    else
      sudo apt-get install -y git 2>/dev/null \
        || sudo dnf install -y git 2>/dev/null \
        || sudo pacman -S --noconfirm git 2>/dev/null \
        || sudo apk add --no-cache git 2>/dev/null \
        || sudo xbps-install -y git 2>/dev/null \
        || { echo "ERROR: install git manually then re-run"; exit 1; }
    fi
  fi
  echo "git: $(git --version)"

  # ── 2. Node.js 24 ───────────────────────────────────────────────────────────

  if [ "$PLATFORM" = "mac" ]; then
    if ! node --version 2>/dev/null | grep -q "^v24"; then
      if command -v brew >/dev/null 2>&1; then
        echo "Installing Node.js 24..."
        brew install node@24
        brew link --overwrite --force node@24 2>/dev/null || true
      else
        echo "ERROR: Homebrew not found. Install from https://brew.sh then re-run."
        exit 1
      fi
    fi
    NPM="$(which npm)"
  else
    export NVM_DIR="$HOME/.nvm"
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
      echo "Installing nvm..."
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    fi
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    nvm install 24 --no-progress
    nvm use 24
    NPM="$(which npm)"
  fi
  echo "node: $(node --version)  npm: $(npm --version)"

  # ── 3. Bun ──────────────────────────────────────────────────────────────────

  if ! command -v bun >/dev/null 2>&1; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
  fi
  export PATH="$HOME/.bun/bin:$PATH"
  BUN="$(which bun)"
  echo "bun: $(bun --version)"

<<<<<<< HEAD
  # ── 4. Claude CLI (optional when using an alternative provider) ─────────────

  if [ -n "$AM_PROVIDER" ] && [ "$AM_PROVIDER" != "claude" ]; then
    echo "Skipping Claude CLI — using provider: $AM_PROVIDER"
    CLAUDE=""
  else
=======
  # ── 4. Claude CLI (optional — skipped when AM_PROVIDER is set to non-claude) ─

  local NEED_CLAUDE=true
  if [ -n "$AM_PROVIDER" ] && [ "$AM_PROVIDER" != "claude" ]; then
    NEED_CLAUDE=false
    echo "AM_PROVIDER=$AM_PROVIDER — skipping Claude CLI install"
  fi

  CLAUDE=""
  if [ "$NEED_CLAUDE" = true ]; then
>>>>>>> 1bd92c5 (make claude code optional, support hermes + qwen3 providers)
    if ! command -v claude >/dev/null 2>&1; then
      echo "Installing Claude CLI..."
      npm install -g @anthropic-ai/claude-code
    fi
    CLAUDE="$(which claude 2>/dev/null || echo "$HOME/.local/bin/claude")"
    echo "claude: $CLAUDE"
  fi

  # ── 5. Board dependencies ───────────────────────────────────────────────────

  echo ""
  echo "Installing board dependencies..."
  cd "$REPO/board" && npm install && cd "$REPO"
  echo "  done"

  # ── 6. Init bin/ ────────────────────────────────────────────────────────────

  echo ""
  echo "Initialising bin/..."
  # shellcheck source=/dev/null
  source "$REPO/init.sh"
  echo "  done"

  # ── 7. Workspaces git repo ──────────────────────────────────────────────────

  local WORKSPACES="$REPO/workspaces"
  if [ ! -d "$WORKSPACES/.git" ]; then
    echo ""
    echo "Initialising workspaces repo..."
    git -C "$WORKSPACES" init -b main

    if command -v git-lfs >/dev/null 2>&1; then
      git -C "$WORKSPACES" lfs install --local
      cat > "$WORKSPACES/.gitattributes" <<'ATTRS'
*.db     filter=lfs diff=lfs merge=lfs -text
*.db-wal filter=lfs diff=lfs merge=lfs -text
*.db-shm filter=lfs diff=lfs merge=lfs -text
*.png    filter=lfs diff=lfs merge=lfs -text
*.jpg    filter=lfs diff=lfs merge=lfs -text
*.jpeg   filter=lfs diff=lfs merge=lfs -text
*.webp   filter=lfs diff=lfs merge=lfs -text
*.mp4    filter=lfs diff=lfs merge=lfs -text
ATTRS
      echo "  git-lfs configured"
    else
      echo "  WARNING: git-lfs not found — brew install git-lfs"
    fi

    cat > "$WORKSPACES/.gitignore" <<'GITIGNORE'
helloam-www/
vault/
am-board/
cards/
GITIGNORE

    git -C "$WORKSPACES" add .gitattributes .gitignore memory/ 2>/dev/null || true
    git -C "$WORKSPACES" commit -m "init: workspaces repo" 2>/dev/null || true
    echo "  done"
  fi

  # ── 8. Register services ────────────────────────────────────────────────────

  echo ""
  echo "Registering services..."

  if [ "$PLATFORM" = "mac" ]; then
    _install_mac
  else
    _install_linux
  fi

  # ── 9. Build and deploy board ───────────────────────────────────────────────

  echo ""
  echo "Building and deploying board..."

  local BOARD="$REPO/board"
  if [ -e "$BOARD/.next" ] && [ ! -L "$BOARD/.next" ]; then
    mkdir -p "$BOARD/deployments"
    mv "$BOARD/.next" "$BOARD/deployments/initial"
    ln -sfn "deployments/current" "$BOARD/.next"
    ln -sfn "initial" "$BOARD/deployments/current"
  elif [ ! -e "$BOARD/.next" ]; then
    mkdir -p "$BOARD/deployments"
    ln -sfn "deployments/current" "$BOARD/.next"
  fi

  AM_BOARD_DEPLOY_ALLOWED=1 board-deploy

  # ── 10. Init DB ─────────────────────────────────────────────────────────────

  if [ ! -f "$REPO/board/board.db" ]; then
    echo ""
    echo "Initialising database..."
    cd "$REPO/board" && DB_PATH="$REPO/board/board.db" npm run db:init && cd "$REPO"
    echo "  done"
  fi

  # ── Done ────────────────────────────────────────────────────────────────────

  echo ""
  echo "Done."
  echo ""
  echo "  Board: http://localhost:$PROD_PORT"
  echo "  Logs:  tail -f /tmp/am-board.log"
  echo ""
  echo "Sign in with your Anthropic account in the onboarding flow."
  echo ""

  # ── Open browser ─────────────────────────────────────────────────────────────

  echo "Waiting for AM Board..."
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:$PROD_PORT" >/dev/null 2>&1; then
      echo "  ready — opening http://localhost:$PROD_PORT"
      if [ "$PLATFORM" = "mac" ]; then
        open "http://localhost:$PROD_PORT"
      else
        xdg-open "http://localhost:$PROD_PORT" 2>/dev/null || true
      fi
      break
    fi
    sleep 2
  done
}

# ── Service installers ────────────────────────────────────────────────────────

_install_mac() {
  local LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
  mkdir -p "$LAUNCH_AGENTS"

  for bin in "$HOME/.bun/bin/"*; do
    xattr -dr com.apple.quarantine "$bin" 2>/dev/null || true
  done

  local CLAUDE_DIR=""
  if [ -n "$CLAUDE" ]; then
    CLAUDE_DIR="$(dirname "$CLAUDE"):"
  fi
  local LAUNCHD_PATH
<<<<<<< HEAD
=======
  local CLAUDE_DIR=""
  if [ -n "$CLAUDE" ] && command -v "$CLAUDE" >/dev/null 2>&1; then
    CLAUDE_DIR="$(dirname "$CLAUDE"):"
  fi
>>>>>>> 1bd92c5 (make claude code optional, support hermes + qwen3 providers)
  LAUNCHD_PATH="${CLAUDE_DIR}$(dirname "$BUN"):$(dirname "$NPM"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

  cat > "$LAUNCH_AGENTS/am.board.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>am.board</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>cd $REPO/board && $NPM run start</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key><string>$LAUNCHD_PATH</string>
        <key>HOME</key><string>$HOME</string>
        <key>USER</key><string>$(whoami)</string>
        <key>PORT</key><string>$PROD_PORT</string>
        <key>WS_URL</key><string>http://localhost:$WS_PORT</string>
        <key>NEXT_PUBLIC_WS_URL</key><string>ws://localhost:$WS_PORT</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/am-board.log</string>
    <key>StandardErrorPath</key><string>/tmp/am-board.log</string>
</dict>
</plist>
EOF

  cat > "$LAUNCH_AGENTS/am.ws-server.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>am.ws-server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$BUN</string>
        <string>run</string>
        <string>$REPO/bin/ws-server</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key><string>$LAUNCHD_PATH</string>
        <key>HOME</key><string>$HOME</string>
        <key>WS_PORT</key><string>$WS_PORT</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/am-ws-server.log</string>
    <key>StandardErrorPath</key><string>/tmp/am-ws-server.log</string>
</dict>
</plist>
EOF

  cat > "$LAUNCH_AGENTS/am.dispatcher.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>am.dispatcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>$BUN</string>
        <string>run</string>
        <string>$REPO/bin/dispatcher</string>
    </array>
    <key>WorkingDirectory</key><string>$REPO</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key><string>$LAUNCHD_PATH</string>
        <key>HOME</key><string>$HOME</string>
        <key>USER</key><string>$(whoami)</string>
        <key>BOARD_URL</key><string>http://localhost:$PROD_PORT</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/am-dispatcher.log</string>
    <key>StandardErrorPath</key><string>/tmp/am-dispatcher.log</string>
</dict>
</plist>
EOF

  local GUI_UID
  GUI_UID=$(id -u)
  for LABEL in am.board am.ws-server am.dispatcher; do
    launchctl bootout "gui/$GUI_UID/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$GUI_UID" "$LAUNCH_AGENTS/$LABEL.plist"
    echo "  loaded $LABEL"
  done
  echo "  Logs: tail -f /tmp/am-board.log"
}

_install_linux() {
  local INIT_SYSTEM init1
  init1="$(cat /proc/1/comm 2>/dev/null || ps -p 1 -o comm= 2>/dev/null || echo unknown)"
  if [ "$init1" = "systemd" ] || systemctl --user status >/dev/null 2>&1; then
    INIT_SYSTEM="systemd"
  elif command -v sv >/dev/null 2>&1 && [ -d /var/service ]; then
    INIT_SYSTEM="runit"
  elif command -v rc-service >/dev/null 2>&1 || [ -f /sbin/openrc ]; then
    INIT_SYSTEM="openrc"
  else
    INIT_SYSTEM="fallback"
  fi
  echo "  init system: $INIT_SYSTEM"

  local CLAUDE_DIR=""
  if [ -n "$CLAUDE" ]; then
    CLAUDE_DIR="$(dirname "$CLAUDE"):"
  fi
  local SERVICE_PATH
<<<<<<< HEAD
  SERVICE_PATH="${CLAUDE_DIR}$HOME/.bun/bin:$(dirname "$NPM"):${NVM_DIR:-$HOME/.nvm}/versions/node/$(node --version)/bin:/usr/local/bin:/usr/bin:/bin"
=======
  local CLAUDE_DIR_LINUX=""
  if [ -n "$CLAUDE" ] && command -v "$CLAUDE" >/dev/null 2>&1; then
    CLAUDE_DIR_LINUX="$(dirname "$CLAUDE"):"
  fi
  SERVICE_PATH="${CLAUDE_DIR_LINUX}$HOME/.bun/bin:$(dirname "$NPM"):${NVM_DIR:-$HOME/.nvm}/versions/node/$(node --version)/bin:/usr/local/bin:/usr/bin:/bin"
>>>>>>> 1bd92c5 (make claude code optional, support hermes + qwen3 providers)

  if [ "$INIT_SYSTEM" = "systemd" ]; then
    local UNIT_DIR="$HOME/.config/systemd/user"
    mkdir -p "$UNIT_DIR"

    cat > "$UNIT_DIR/am-board.service" <<EOF
[Unit]
Description=AM Board
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO/board
ExecStartPre=/bin/sh -c 'fuser -k $PROD_PORT/tcp 2>/dev/null || true'
ExecStart=$NPM run start
Restart=always
RestartSec=3
Environment=PATH=$SERVICE_PATH
Environment=HOME=$HOME
Environment=PORT=$PROD_PORT
Environment=WS_URL=http://localhost:$WS_PORT
Environment=NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT

[Install]
WantedBy=default.target
EOF

    cat > "$UNIT_DIR/am-ws-server.service" <<EOF
[Unit]
Description=AM WS Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO
ExecStart=$BUN run $REPO/bin/ws-server
Restart=always
RestartSec=3
Environment=PATH=$SERVICE_PATH
Environment=HOME=$HOME
Environment=WS_PORT=$WS_PORT

[Install]
WantedBy=default.target
EOF

    cat > "$UNIT_DIR/am-dispatcher.service" <<EOF
[Unit]
Description=AM Dispatcher
After=network.target am-board.service

[Service]
Type=simple
WorkingDirectory=$REPO
ExecStart=$BUN run $REPO/bin/dispatcher
Restart=always
RestartSec=5
Environment=PATH=$SERVICE_PATH
Environment=HOME=$HOME
Environment=BOARD_URL=http://localhost:$PROD_PORT

[Install]
WantedBy=default.target
EOF

    loginctl enable-linger "$(whoami)" 2>/dev/null || true
    systemctl --user daemon-reload
    systemctl --user enable am-board.service am-ws-server.service am-dispatcher.service
    systemctl --user restart am-board.service am-ws-server.service am-dispatcher.service
    echo "  Logs: journalctl --user -u am-board -f"
  else
    local LAUNCHER="$HOME/.am/launch.sh"
    mkdir -p "$HOME/.am"

    cat > "$LAUNCHER" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
${NVM_DIR:+export NVM_DIR=$NVM_DIR}
${NVM_DIR:+[ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"}

_am_start() {
  local name=\$1; shift
  local log=\$1; shift
  if ! pgrep -f "\$1" >/dev/null 2>&1; then
    "\$@" >> "\$log" 2>&1 &
    echo "started \$name (pid \$!)"
  fi
}

_am_start am-board      /tmp/am-board.log      sh -c "PORT=$PROD_PORT WS_URL=http://localhost:$WS_PORT NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT cd $REPO/board && $NPM run start"
_am_start am-ws-server  /tmp/am-ws-server.log  sh -c "WS_PORT=$WS_PORT $BUN run $REPO/bin/ws-server"
_am_start am-dispatcher /tmp/am-dispatcher.log sh -c "BOARD_URL=http://localhost:$PROD_PORT $BUN run $REPO/bin/dispatcher"
EOF
    chmod +x "$LAUNCHER"

    local MARKER="# am-services"
    if ! grep -q "$MARKER" "$HOME/.profile" 2>/dev/null; then
      printf '\n%s\n[ -f %s ] && . %s\n' "$MARKER" "$LAUNCHER" "$LAUNCHER" >> "$HOME/.profile"
      echo "  added launcher to ~/.profile"
    fi
    # shellcheck source=/dev/null
    . "$LAUNCHER"
    echo "  Logs: tail -f /tmp/am-board.log"
  fi
}

main "$@"
