#!/usr/bin/env bash
# install.sh — install dependencies and register launch services (Linux)
#
# Detects the init system and uses the right service manager:
#   systemd  → ~/.config/systemd/user/ (Ubuntu, Debian, Fedora, Arch, etc.)
#   OpenRC   → /etc/local.d/ + openrc-run  (Alpine, Gentoo, Artix-OpenRC)
#   runit    → ~/sv/ via vlogger           (Void Linux, Artix-runit)
#   upstart  → ~/.init/                    (legacy Ubuntu < 15.04)
#   fallback → ~/.am/start.sh launched from ~/.profile / ~/.bashrc
#
# Run once after cloning:
#   bash launchagents/linux/install.sh
#
# Logs:
#   systemd:  journalctl --user -u am-board -f
#             journalctl --user -u am-ws-server -f
#   others:   tail -f /tmp/am-board.log
#             tail -f /tmp/am-ws-server.log

set -e

REPO="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Repo: $REPO"

# ── Detect init system ────────────────────────────────────────────────────────

detect_init() {
  # Check PID 1 name
  local init1
  init1="$(cat /proc/1/comm 2>/dev/null || ps -p 1 -o comm= 2>/dev/null || echo unknown)"

  if [ "$init1" = "systemd" ] || systemctl --user status >/dev/null 2>&1; then
    echo "systemd"
  elif command -v rc-service >/dev/null 2>&1 || [ -f /sbin/openrc ]; then
    echo "openrc"
  elif command -v sv >/dev/null 2>&1 && [ -d /var/service ]; then
    echo "runit"
  elif command -v initctl >/dev/null 2>&1 && initctl --version 2>/dev/null | grep -q upstart; then
    echo "upstart"
  else
    echo "fallback"
  fi
}

INIT_SYSTEM="$(detect_init)"
echo "Init system: $INIT_SYSTEM"

# ── 1. Git ────────────────────────────────────────────────────────────────────

if ! command -v git >/dev/null 2>&1; then
  echo "Installing git..."
  sudo apt-get install -y git 2>/dev/null \
    || sudo dnf install -y git 2>/dev/null \
    || sudo pacman -S --noconfirm git 2>/dev/null \
    || sudo apk add --no-cache git 2>/dev/null \
    || sudo xbps-install -y git 2>/dev/null \
    || { echo "ERROR: install git manually then re-run"; exit 1; }
fi
echo "git: $(git --version)"

# ── 2. Node.js (via nvm) ──────────────────────────────────────────────────────

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
echo "node: $(node --version)  npm: $(npm --version)"

# ── 3. Bun ────────────────────────────────────────────────────────────────────

if ! command -v bun >/dev/null 2>&1; then
  echo "Installing bun..."
  curl -fsSL https://bun.sh/install | bash
fi
export PATH="$HOME/.bun/bin:$PATH"
BUN="$(which bun)"
echo "bun: $(bun --version)"

# ── 4. Claude CLI ─────────────────────────────────────────────────────────────

if ! command -v claude >/dev/null 2>&1; then
  echo "Installing Claude CLI..."
  npm install -g @anthropic-ai/claude-code
fi
CLAUDE="$(which claude)"
echo "claude: $CLAUDE"

# ── 5. Board app dependencies ─────────────────────────────────────────────────

echo "Installing board dependencies..."
cd "$REPO/board" && npm install
cd "$REPO"

# ── 6. Init bin/ ──────────────────────────────────────────────────────────────

# shellcheck source=/dev/null
source "$REPO/init.sh"

# ── 7. Build shared env block ─────────────────────────────────────────────────

SERVICE_PATH="$(dirname "$CLAUDE"):$HOME/.bun/bin:$(dirname "$NPM"):$NVM_DIR/versions/node/$(node --version)/bin:/usr/local/bin:/usr/bin:/bin"

BOARD_LOG="/tmp/am-board.log"
DISPATCHER_LOG="/tmp/am-dispatcher.log"
WS_SERVER_LOG="/tmp/am-ws-server.log"

# ── 8. Register services ──────────────────────────────────────────────────────

install_systemd() {
  local UNIT_DIR="$HOME/.config/systemd/user"
  mkdir -p "$UNIT_DIR"

  cat > "$UNIT_DIR/am-board.service" <<EOF
[Unit]
Description=AM Board (Next.js web UI)
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO/board
ExecStartPre=/bin/sh -c 'fuser -k 4200/tcp 2>/dev/null || true'
ExecStart=$NPM run dev
Restart=always
RestartSec=3
Environment=PATH=$SERVICE_PATH
Environment=HOME=$HOME
Environment=WS_URL=http://localhost:4201
Environment=NEXT_PUBLIC_WS_URL=ws://localhost:4201

[Install]
WantedBy=default.target
EOF

  cat > "$UNIT_DIR/am-ws-server.service" <<EOF
[Unit]
Description=AM WS Server (WebSocket server)
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO
ExecStart=$BUN run $REPO/bin/ws-server
Restart=always
RestartSec=3
Environment=PATH=$SERVICE_PATH
Environment=HOME=$HOME
Environment=WS_PORT=4201

[Install]
WantedBy=default.target
EOF

  cat > "$UNIT_DIR/am-dispatcher.service" <<EOF
[Unit]
Description=AM Dispatcher (agent loop)
After=network.target am-board.service
Wants=am-board.service

[Service]
Type=simple
WorkingDirectory=$REPO
ExecStart=$BUN run $REPO/bin/dispatcher
Restart=always
RestartSec=5
Environment=PATH=$SERVICE_PATH
Environment=HOME=$HOME
Environment=BOARD_URL=http://localhost:4200

[Install]
WantedBy=default.target
EOF

  loginctl enable-linger "$(whoami)" 2>/dev/null || true
  systemctl --user daemon-reload
  systemctl --user enable am-board.service am-ws-server.service am-dispatcher.service
  systemctl --user restart am-board.service am-ws-server.service am-dispatcher.service
  echo "Logs: journalctl --user -u am-board -f"
  echo "      journalctl --user -u am-ws-server -f"
  echo "      journalctl --user -u am-dispatcher -f"
}

install_openrc() {
  # OpenRC user services aren't well standardised — use local.d scripts run as root
  # or, for non-root, a supervisord/runit-like wrapper in ~/.am/
  local SV_DIR="$HOME/.am/sv"
  mkdir -p "$SV_DIR/am-board" "$SV_DIR/am-dispatcher" "$SV_DIR/am-ws-server"

  cat > "$SV_DIR/am-board/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export NVM_DIR=$NVM_DIR
export WS_URL=http://localhost:4201
export NEXT_PUBLIC_WS_URL=ws://localhost:4201
[ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
fuser -k 4200/tcp 2>/dev/null || true
cd $REPO/board
exec $NPM run dev >> $BOARD_LOG 2>&1
EOF
  chmod +x "$SV_DIR/am-board/run"

  cat > "$SV_DIR/am-ws-server/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export WS_PORT=4201
exec $BUN run $REPO/bin/ws-server >> $WS_SERVER_LOG 2>&1
EOF
  chmod +x "$SV_DIR/am-ws-server/run"

  cat > "$SV_DIR/am-dispatcher/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export BOARD_URL=http://localhost:4200
exec $BUN run $REPO/bin/dispatcher >> $DISPATCHER_LOG 2>&1
EOF
  chmod +x "$SV_DIR/am-dispatcher/run"

  # Launch via ~/.profile with busybox runit or s6 if available, else background
  _install_profile_launcher
  echo "Logs: tail -f $BOARD_LOG"
  echo "      tail -f $WS_SERVER_LOG"
  echo "      tail -f $DISPATCHER_LOG"
}

install_runit() {
  local SV_DIR="$HOME/sv"
  mkdir -p "$SV_DIR/am-board" "$SV_DIR/am-dispatcher" "$SV_DIR/am-ws-server"

  cat > "$SV_DIR/am-board/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export WS_URL=http://localhost:4201
export NEXT_PUBLIC_WS_URL=ws://localhost:4201
fuser -k 4200/tcp 2>/dev/null || true
cd $REPO/board
exec $NPM run dev
EOF
  chmod +x "$SV_DIR/am-board/run"

  cat > "$SV_DIR/am-ws-server/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export WS_PORT=4201
exec $BUN run $REPO/bin/ws-server
EOF
  chmod +x "$SV_DIR/am-ws-server/run"

  cat > "$SV_DIR/am-dispatcher/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export BOARD_URL=http://localhost:4200
exec $BUN run $REPO/bin/dispatcher
EOF
  chmod +x "$SV_DIR/am-dispatcher/run"

  # Symlink into user's service directory if it exists
  for svc in am-board am-ws-server am-dispatcher; do
    ln -sf "$SV_DIR/$svc" "$HOME/.local/sv/$svc" 2>/dev/null \
      || ln -sf "$SV_DIR/$svc" "/var/service/$svc" 2>/dev/null \
      || true
  done
  echo "Logs: tail -f $BOARD_LOG"
  echo "      tail -f $WS_SERVER_LOG"
  echo "      (runit logs via vlogger if configured)"
}

install_upstart() {
  local INIT_DIR="$HOME/.init"
  mkdir -p "$INIT_DIR"

  cat > "$INIT_DIR/am-board.conf" <<EOF
description "AM Board"
start on started dbus
stop on stopping dbus
respawn
script
  export PATH=$SERVICE_PATH
  export HOME=$HOME
  export WS_URL=http://localhost:4201
  export NEXT_PUBLIC_WS_URL=ws://localhost:4201
  fuser -k 4200/tcp 2>/dev/null || true
  cd $REPO/board
  exec $NPM run dev >> $BOARD_LOG 2>&1
end script
EOF

  cat > "$INIT_DIR/am-ws-server.conf" <<EOF
description "AM WS Server"
start on started dbus
stop on stopping dbus
respawn
script
  export PATH=$SERVICE_PATH
  export HOME=$HOME
  export WS_PORT=4201
  exec $BUN run $REPO/bin/ws-server >> $WS_SERVER_LOG 2>&1
end script
EOF

  cat > "$INIT_DIR/am-dispatcher.conf" <<EOF
description "AM Dispatcher"
start on started am-board
stop on stopping am-board
respawn
script
  export PATH=$SERVICE_PATH
  export HOME=$HOME
  export BOARD_URL=http://localhost:4200
  exec $BUN run $REPO/bin/dispatcher >> $DISPATCHER_LOG 2>&1
end script
EOF

  initctl reload-configuration 2>/dev/null || true
  initctl start am-board 2>/dev/null || true
  initctl start am-ws-server 2>/dev/null || true
  initctl start am-dispatcher 2>/dev/null || true
  echo "Logs: tail -f $BOARD_LOG"
  echo "      tail -f $WS_SERVER_LOG"
}

_install_profile_launcher() {
  # Fallback: write a launcher script and hook it from ~/.profile
  local LAUNCHER="$HOME/.am/launch.sh"
  mkdir -p "$HOME/.am"

  cat > "$LAUNCHER" <<EOF
#!/bin/sh
# AM services — launched from ~/.profile
export PATH=$SERVICE_PATH
export HOME=$HOME
export NVM_DIR=$NVM_DIR
[ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"

_am_start() {
  local name=\$1; shift
  local log=\$1; shift
  if ! pgrep -f "\$1" >/dev/null 2>&1; then
    "\$@" >> "\$log" 2>&1 &
    echo "started \$name (pid \$!)"
  fi
}

_am_start am-board      $BOARD_LOG      sh -c 'WS_URL=http://localhost:4201 NEXT_PUBLIC_WS_URL=ws://localhost:4201 cd $REPO/board && $NPM run dev'
_am_start am-ws-server  $WS_SERVER_LOG  sh -c 'WS_PORT=4201 $BUN run $REPO/bin/ws-server'
_am_start am-dispatcher $DISPATCHER_LOG $BUN run $REPO/bin/dispatcher
EOF
  chmod +x "$LAUNCHER"

  # Add to ~/.profile if not already there
  local MARKER="# am-services"
  if ! grep -q "$MARKER" "$HOME/.profile" 2>/dev/null; then
    echo "" >> "$HOME/.profile"
    echo "$MARKER" >> "$HOME/.profile"
    echo "[ -f $LAUNCHER ] && . $LAUNCHER" >> "$HOME/.profile"
    echo "Added launcher to ~/.profile"
  fi

  # Run immediately in this session
  # shellcheck source=/dev/null
  . "$LAUNCHER"
}

install_fallback() {
  echo "No recognised init system — using profile-based launcher"
  _install_profile_launcher
  echo "Logs: tail -f $BOARD_LOG"
  echo "      tail -f $WS_SERVER_LOG"
  echo "      tail -f $DISPATCHER_LOG"
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

case "$INIT_SYSTEM" in
  systemd)  install_systemd ;;
  openrc)   install_openrc ;;
  runit)    install_runit ;;
  upstart)  install_upstart ;;
  *)        install_fallback ;;
esac

echo ""
echo "Done."
echo "  Board:     http://localhost:4200"
echo "  WS Server: ws://localhost:4201"
echo "  Login:     claude /login"
