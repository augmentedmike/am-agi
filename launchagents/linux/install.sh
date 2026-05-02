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
PROD_PORT=4220
DEV_PORT=4221
WS_PORT=4201
PROD_HOST="${AM_PROD_HOST:-helloam.localhost}"
DEV_HOST="${AM_DEV_HOST:-helloam-dev.localhost}"
PROD_URL="http://$PROD_HOST"
DEV_URL="http://$DEV_HOST"
PROD_INTERNAL_URL="http://127.0.0.1:$PROD_PORT"
DEV_INTERNAL_URL="http://127.0.0.1:$DEV_PORT"

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

setup_localhost_names() {
  echo "Configuring local hostnames..."
  local hosts_line="127.0.0.1 $PROD_HOST $DEV_HOST"
  local hosts_v6_line="::1 $PROD_HOST $DEV_HOST"
  if grep -Eq "(^|[[:space:]])$PROD_HOST([[:space:]]|$)" /etc/hosts \
    && grep -Eq "(^|[[:space:]])$DEV_HOST([[:space:]]|$)" /etc/hosts; then
    echo "  $PROD_HOST and $DEV_HOST already configured"
  elif [ -w /etc/hosts ]; then
    {
      echo ""
      echo "# HelloAm local board URLs"
      echo "$hosts_line"
      echo "$hosts_v6_line"
    } >> /etc/hosts
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    printf '\n# HelloAm local board URLs\n%s\n%s\n' "$hosts_line" "$hosts_v6_line" \
      | sudo tee -a /etc/hosts >/dev/null
  else
    echo "  WARNING: could not write /etc/hosts without sudo."
    echo "  Add manually if these names do not resolve:"
    echo "    $hosts_line"
    echo "    $hosts_v6_line"
  fi
}

write_caddyfile() {
  local caddyfile="$1"
  mkdir -p "$(dirname "$caddyfile")"
  cat > "$caddyfile" <<EOF
{
  auto_https off
}

http://$PROD_HOST {
  reverse_proxy 127.0.0.1:$PROD_PORT
}

http://$DEV_HOST {
  reverse_proxy 127.0.0.1:$DEV_PORT
}
EOF
}

install_caddy_linux() {
  echo "Installing Caddy..."
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

setup_portless_proxy() {
  echo "Configuring portless local URLs..."
  if [ "${AM_SKIP_PORTLESS_PROXY:-}" = "1" ]; then
    echo "  skipped (AM_SKIP_PORTLESS_PROXY=1)"
    return
  fi
  if ! command -v caddy >/dev/null 2>&1; then
    install_caddy_linux || {
      echo "  WARNING: install Caddy manually for portless URLs."
      return
    }
  fi

  local caddyfile="$HOME/.config/helloam/Caddyfile"
  write_caddyfile "$caddyfile"
  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo mkdir -p /etc/caddy
    sudo cp "$caddyfile" /etc/caddy/helloam.Caddyfile
    if command -v systemctl >/dev/null 2>&1; then
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
      sudo cp "$HOME/.config/helloam/helloam-caddy.service" /etc/systemd/system/helloam-caddy.service
      sudo systemctl daemon-reload
      sudo systemctl enable --now helloam-caddy.service
    else
      sudo caddy stop 2>/dev/null || true
      sudo caddy start --config "$caddyfile" --adapter caddyfile
    fi
    echo "  $PROD_URL -> $PROD_INTERNAL_URL"
    echo "  $DEV_URL -> $DEV_INTERNAL_URL"
  else
    echo "  WARNING: Caddy needs sudo once to bind port 80."
    echo "  Run:"
    echo "    sudo caddy start --config \"$caddyfile\" --adapter caddyfile"
  fi
}

setup_localhost_names

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

setup_portless_proxy

# ── 4. Model provider ────────────────────────────────────────────────────────

CLAUDE=""
echo "model provider: configured in the board onboarding flow"

# ── 5. Board app dependencies ─────────────────────────────────────────────────

echo "Installing board dependencies..."
cd "$REPO/board" && npm install
cd "$REPO"

# ── 6. Init bin/ ──────────────────────────────────────────────────────────────

# shellcheck source=/dev/null
source "$REPO/init.sh"

# ── 7. Build shared env block ─────────────────────────────────────────────────

CLAUDE_DIR=""
if [ -n "$CLAUDE" ]; then
  CLAUDE_DIR="$(dirname "$CLAUDE"):"
fi
SERVICE_PATH="${CLAUDE_DIR}$HOME/.bun/bin:$(dirname "$NPM"):$NVM_DIR/versions/node/$(node --version)/bin:/usr/local/bin:/usr/bin:/bin"

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
ExecStartPre=/bin/sh -c 'fuser -k $PROD_PORT/tcp 2>/dev/null || true'
ExecStart=$NPM run dev
Restart=always
RestartSec=3
Environment=PATH=$SERVICE_PATH
Environment=HOME=$HOME
Environment=WS_URL=http://localhost:$WS_PORT
Environment=NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT
Environment=NEXT_PUBLIC_BASE_URL=$PROD_URL
Environment=BOARD_URL=$PROD_URL

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
Environment=WS_PORT=$WS_PORT

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
Environment=BOARD_URL=$PROD_URL

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
export WS_URL=http://localhost:$WS_PORT
export NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT
export NEXT_PUBLIC_BASE_URL=$PROD_URL
export BOARD_URL=$PROD_URL
[ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
fuser -k $PROD_PORT/tcp 2>/dev/null || true
cd $REPO/board
exec $NPM run dev >> $BOARD_LOG 2>&1
EOF
  chmod +x "$SV_DIR/am-board/run"

  cat > "$SV_DIR/am-ws-server/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export WS_PORT=$WS_PORT
exec $BUN run $REPO/bin/ws-server >> $WS_SERVER_LOG 2>&1
EOF
  chmod +x "$SV_DIR/am-ws-server/run"

  cat > "$SV_DIR/am-dispatcher/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export BOARD_URL=$PROD_URL
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
export WS_URL=http://localhost:$WS_PORT
export NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT
export NEXT_PUBLIC_BASE_URL=$PROD_URL
export BOARD_URL=$PROD_URL
fuser -k $PROD_PORT/tcp 2>/dev/null || true
cd $REPO/board
exec $NPM run dev
EOF
  chmod +x "$SV_DIR/am-board/run"

  cat > "$SV_DIR/am-ws-server/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export WS_PORT=$WS_PORT
exec $BUN run $REPO/bin/ws-server
EOF
  chmod +x "$SV_DIR/am-ws-server/run"

  cat > "$SV_DIR/am-dispatcher/run" <<EOF
#!/bin/sh
export PATH=$SERVICE_PATH
export HOME=$HOME
export BOARD_URL=$PROD_URL
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
  export WS_URL=http://localhost:$WS_PORT
  export NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT
  export NEXT_PUBLIC_BASE_URL=$PROD_URL
  export BOARD_URL=$PROD_URL
  fuser -k $PROD_PORT/tcp 2>/dev/null || true
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
  export WS_PORT=$WS_PORT
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
  export BOARD_URL=$PROD_URL
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

_am_start am-board      $BOARD_LOG      sh -c 'WS_URL=http://localhost:$WS_PORT NEXT_PUBLIC_WS_URL=ws://localhost:$WS_PORT NEXT_PUBLIC_BASE_URL=$PROD_URL BOARD_URL=$PROD_URL cd $REPO/board && $NPM run dev'
_am_start am-ws-server  $WS_SERVER_LOG  sh -c 'WS_PORT=$WS_PORT $BUN run $REPO/bin/ws-server'
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
echo "  Board:     $PROD_URL"
echo "  Dev:       $DEV_URL"
echo "  WS Server: ws://localhost:$WS_PORT"
echo "  Provider:  configure model/API key in the board onboarding flow"

# ── Open browser once board is ready ─────────────────────────────────────────
echo ""
echo "Waiting for board to be ready..."
for i in $(seq 1 60); do
  if curl -sf "$PROD_URL" >/dev/null 2>&1; then
    echo "Board is ready — opening $PROD_URL"
    xdg-open "$PROD_URL"
    break
  fi
  sleep 2
done
