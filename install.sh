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
#   2. Installs Git, Node.js 24, and Bun
#   3. Installs board npm dependencies and builds
#   4. Initialises bin/ and workspaces
#   5. Registers background services (LaunchAgents on macOS, systemd/fallback on Linux)
#   6. Creates board.db with full schema
#   7. Opens http://helloam.localhost

set -e

PROD_PORT=4220
WS_PORT=4201
PROD_HOST="${AM_PROD_HOST:-helloam.localhost}"
DEV_HOST="${AM_DEV_HOST:-helloam-dev.localhost}"
PROD_URL="http://$PROD_HOST"
DEV_URL="http://$DEV_HOST"
PROD_INTERNAL_URL="http://127.0.0.1:$PROD_PORT"
DEV_INTERNAL_URL="http://127.0.0.1:4221"

main() {
  # ── Locate or clone repo ────────────────────────────────────────────────────

  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"

  if [ -f "$SCRIPT_DIR/board/package.json" ] && [ -f "$SCRIPT_DIR/init.sh" ]; then
    REPO="$SCRIPT_DIR"
  elif [ -f "./board/package.json" ] && [ -f "./init.sh" ]; then
    REPO="$(pwd)"
  else
    local DEST="${AM_INSTALL_DIR:-$HOME/am-agi}"
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

  # ── Local hostnames ────────────────────────────────────────────────────────

  _setup_localhost_names
  _setup_portless_proxy

  # ── 3. Bun ──────────────────────────────────────────────────────────────────

  if ! command -v bun >/dev/null 2>&1; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
  fi
  export PATH="$HOME/.bun/bin:$PATH"
  BUN="$(which bun)"
  echo "bun: $(bun --version)"

  # ── 4. Model provider ──────────────────────────────────────────────────────

  CLAUDE=""
  echo "model provider: configured in the board onboarding flow"

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
  echo "  Board: $PROD_URL"
  echo "  Dev:   $DEV_URL"
  echo "  Logs:  tail -f /tmp/am-board.log"
  echo ""
  echo "Choose a model provider and API key in the onboarding flow."
  echo ""

  # ── Open browser ─────────────────────────────────────────────────────────────

  echo "Waiting for AM Board..."
  for i in $(seq 1 30); do
    if curl -sf "$PROD_URL" >/dev/null 2>&1; then
      echo "  ready — opening $PROD_URL"
      if [ "$PLATFORM" = "mac" ]; then
        open "$PROD_URL"
      else
        xdg-open "$PROD_URL" 2>/dev/null || true
      fi
      break
    fi
    sleep 2
  done
}

# ── Hostname setup ────────────────────────────────────────────────────────────

_setup_localhost_names() {
  echo ""
  echo "Configuring local hostnames..."
  local HOSTS_LINE="127.0.0.1 $PROD_HOST $DEV_HOST"
  local HOSTS_V6_LINE="::1 $PROD_HOST $DEV_HOST"

  if grep -Eq "(^|[[:space:]])$PROD_HOST([[:space:]]|$)" /etc/hosts \
    && grep -Eq "(^|[[:space:]])$DEV_HOST([[:space:]]|$)" /etc/hosts; then
    echo "  $PROD_HOST and $DEV_HOST already configured"
    return
  fi

  if [ -w /etc/hosts ]; then
    {
      echo ""
      echo "# HelloAm local board URLs"
      echo "$HOSTS_LINE"
      echo "$HOSTS_V6_LINE"
    } >> /etc/hosts
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    printf '\n# HelloAm local board URLs\n%s\n%s\n' "$HOSTS_LINE" "$HOSTS_V6_LINE" \
      | sudo tee -a /etc/hosts >/dev/null
  else
    echo "  WARNING: could not write /etc/hosts; add manually:"
    echo "    $HOSTS_LINE"
    echo "    $HOSTS_V6_LINE"
    return
  fi

  echo "  $PROD_URL"
  echo "  $DEV_URL"
}

_write_caddyfile() {
  local CADDYFILE="$1"
  mkdir -p "$(dirname "$CADDYFILE")"
  cat > "$CADDYFILE" <<EOF
{
  auto_https off
}

http://$PROD_HOST {
  reverse_proxy 127.0.0.1:$PROD_PORT
}

http://$DEV_HOST {
  reverse_proxy 127.0.0.1:4221
}
EOF
}

_setup_portless_proxy() {
  echo ""
  echo "Configuring portless local URLs..."

  if [ "${AM_SKIP_PORTLESS_PROXY:-}" = "1" ]; then
    echo "  skipped (AM_SKIP_PORTLESS_PROXY=1)"
    return
  fi

  if [ "$PLATFORM" = "mac" ]; then
    if ! command -v caddy >/dev/null 2>&1; then
      if command -v brew >/dev/null 2>&1; then
        echo "  Installing Caddy..."
        brew install caddy
      else
        echo "  WARNING: Homebrew not found; install Caddy manually for portless URLs."
        return
      fi
    fi

    local CADDYFILE="$REPO/.am/Caddyfile"
    _write_caddyfile "$CADDYFILE"
    echo "  Caddyfile: $CADDYFILE"

    if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
      sudo caddy stop 2>/dev/null || true
      sudo caddy start --config "$CADDYFILE" --adapter caddyfile
      echo "  $PROD_URL → $PROD_INTERNAL_URL"
      echo "  $DEV_URL → $DEV_INTERNAL_URL"
    else
      echo "  WARNING: Caddy needs sudo once to bind port 80."
      echo "  Run:"
      echo "    sudo caddy start --config \"$CADDYFILE\" --adapter caddyfile"
    fi
    return
  fi

  if ! command -v caddy >/dev/null 2>&1; then
    _install_caddy_linux || {
      echo "  WARNING: install Caddy for portless URLs."
      return
    }
  fi

  local CADDYFILE="$HOME/.config/helloam/Caddyfile"
  _write_caddyfile "$CADDYFILE"
  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo mkdir -p /etc/caddy
    sudo cp "$CADDYFILE" /etc/caddy/helloam.Caddyfile
    cat > "$HOME/.config/helloam/helloam-caddy.service" <<EOF
[Unit]
Description=HelloAm local reverse proxy
After=network.target

[Service]
ExecStart=$(command -v caddy) run --config /etc/caddy/helloam.Caddyfile --adapter caddyfile
ExecReload=$(command -v caddy) reload --config /etc/caddy/helloam.Caddyfile --adapter caddyfile --force
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
    sudo cp "$HOME/.config/helloam/helloam-caddy.service" /etc/systemd/system/helloam-caddy.service 2>/dev/null || true
    if command -v systemctl >/dev/null 2>&1 && [ -f /etc/systemd/system/helloam-caddy.service ]; then
      sudo systemctl daemon-reload
      sudo systemctl enable --now helloam-caddy.service
    else
      sudo caddy stop 2>/dev/null || true
      sudo caddy start --config "$CADDYFILE" --adapter caddyfile
    fi
    echo "  $PROD_URL → $PROD_INTERNAL_URL"
    echo "  $DEV_URL → $DEV_INTERNAL_URL"
  else
    echo "  WARNING: Caddy needs sudo once to bind port 80."
    echo "  Run:"
    echo "    sudo caddy start --config \"$CADDYFILE\" --adapter caddyfile"
  fi
}

_install_caddy_linux() {
  echo "  Installing Caddy..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    sudo apt-get update
    sudo apt-get install -y caddy
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y 'dnf-command(copr)' || true
    sudo dnf copr enable -y @caddy/caddy
    sudo dnf install -y caddy
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm caddy
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add caddy
  elif command -v xbps-install >/dev/null 2>&1; then
    sudo xbps-install -y caddy
  else
    return 1
  fi
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
        <key>DB_PATH</key><string>$REPO/board/board.db</string>
        <key>WS_URL</key><string>http://localhost:$WS_PORT</string>
        <key>NEXT_PUBLIC_WS_URL</key><string>ws://localhost:$WS_PORT</string>
        <key>NEXT_PUBLIC_BASE_URL</key><string>$PROD_URL</string>
        <key>BOARD_URL</key><string>$PROD_URL</string>
        <key>AM_INSTALL_DIR</key><string>$REPO</string>
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
        <key>AM_INSTALL_DIR</key><string>$REPO</string>
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
        <key>BOARD_URL</key><string>$PROD_URL</string>
        <key>AM_INSTALL_DIR</key><string>$REPO</string>
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
  SERVICE_PATH="${CLAUDE_DIR}$HOME/.bun/bin:$(dirname "$NPM"):${NVM_DIR:-$HOME/.nvm}/versions/node/$(node --version)/bin:/usr/local/bin:/usr/bin:/bin"

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
Environment=DB_PATH=$REPO/board/board.db
Environment=WS_URL=http://localhost:$WS_PORT
Environment=NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT
Environment=NEXT_PUBLIC_BASE_URL=$PROD_URL
Environment=BOARD_URL=$PROD_URL
Environment=AM_INSTALL_DIR=$REPO

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
Environment=AM_INSTALL_DIR=$REPO

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
Environment=BOARD_URL=$PROD_URL
Environment=AM_INSTALL_DIR=$REPO

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

_am_start am-board      /tmp/am-board.log      sh -c "PORT=$PROD_PORT WS_URL=http://localhost:$WS_PORT NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT NEXT_PUBLIC_BASE_URL=$PROD_URL BOARD_URL=$PROD_URL AM_INSTALL_DIR=$REPO cd $REPO/board && $NPM run start"
_am_start am-ws-server  /tmp/am-ws-server.log  sh -c "WS_PORT=$WS_PORT AM_INSTALL_DIR=$REPO $BUN run $REPO/bin/ws-server"
_am_start am-dispatcher /tmp/am-dispatcher.log sh -c "BOARD_URL=$PROD_URL AM_INSTALL_DIR=$REPO $BUN run $REPO/bin/dispatcher"
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
