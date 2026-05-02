#!/bin/bash
# install.sh — generate and load LaunchAgents for the current user's environment

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="$HOME"
USER_NAME="$(whoami)"
LAUNCH_AGENTS="$HOME_DIR/Library/LaunchAgents"

# Ports
PROD_PORT=4220
DEV_PORT=4221
WS_PORT=4201
PROD_HOST="${AM_PROD_HOST:-helloam.localhost}"
DEV_HOST="${AM_DEV_HOST:-helloam-dev.localhost}"
PROD_URL="http://$PROD_HOST"
DEV_URL="http://$DEV_HOST"
PROD_INTERNAL_URL="http://127.0.0.1:$PROD_PORT"
DEV_INTERNAL_URL="http://127.0.0.1:$DEV_PORT"

# Detect binaries
NPM=$(which npm || echo "/opt/homebrew/opt/node@24/bin/npm")
BUN=$(which bun || echo "$HOME_DIR/.bun/bin/bun")

CLAUDE=""

echo "Repo:   $REPO"
echo "npm:    $NPM"
echo "bun:    $BUN"
echo "provider: configured in the board onboarding flow"
echo "Ports:  prod=$PROD_PORT  dev=$DEV_PORT"

# ── Local hostnames ──────────────────────────────────────────────────────────

echo "Configuring local hostnames..."
HOSTS_LINE="127.0.0.1 $PROD_HOST $DEV_HOST"
HOSTS_V6_LINE="::1 $PROD_HOST $DEV_HOST"
if grep -Eq "(^|[[:space:]])$PROD_HOST([[:space:]]|$)" /etc/hosts \
  && grep -Eq "(^|[[:space:]])$DEV_HOST([[:space:]]|$)" /etc/hosts; then
  echo "  $PROD_HOST and $DEV_HOST already configured"
elif [ -w /etc/hosts ]; then
  {
    echo ""
    echo "# HelloAm local board URLs"
    echo "$HOSTS_LINE"
    echo "$HOSTS_V6_LINE"
  } >> /etc/hosts
  echo "  $PROD_URL"
  echo "  $DEV_URL"
elif sudo -n true 2>/dev/null; then
  printf '\n# HelloAm local board URLs\n%s\n%s\n' "$HOSTS_LINE" "$HOSTS_V6_LINE" \
    | sudo tee -a /etc/hosts >/dev/null
  echo "  $PROD_URL"
  echo "  $DEV_URL"
else
  echo "  WARNING: could not write /etc/hosts without an interactive sudo password"
  echo "  add manually if these names do not resolve on this machine:"
  echo "    $HOSTS_LINE"
  echo "    $HOSTS_V6_LINE"
fi

# ── Portless local URLs via Caddy ────────────────────────────────────────────

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

echo "Configuring portless local URLs..."
if [ "${AM_SKIP_PORTLESS_PROXY:-}" = "1" ]; then
  echo "  skipped (AM_SKIP_PORTLESS_PROXY=1)"
else
  if ! command -v caddy >/dev/null 2>&1; then
    if command -v brew >/dev/null 2>&1; then
      echo "  Installing Caddy..."
      brew install caddy
    else
      echo "  WARNING: Homebrew not found; install Caddy manually for portless URLs."
    fi
  fi
  if command -v caddy >/dev/null 2>&1; then
    CADDYFILE="$REPO/.am/Caddyfile"
    write_caddyfile "$CADDYFILE"
    if sudo -n true 2>/dev/null; then
      sudo caddy stop 2>/dev/null || true
      sudo caddy start --config "$CADDYFILE" --adapter caddyfile
      echo "  $PROD_URL -> $PROD_INTERNAL_URL"
      echo "  $DEV_URL -> $DEV_INTERNAL_URL"
    else
      echo "  WARNING: Caddy needs sudo once to bind port 80."
      echo "  Run:"
      echo "    sudo caddy start --config \"$CADDYFILE\" --adapter caddyfile"
    fi
  fi
fi

# ── Strip macOS quarantine from bun binaries ─────────────────────────────────
# Without this, every bun worker spawn triggers a macOS security popup.
echo "Stripping quarantine from bun binaries..."
for bin in "$HOME_DIR/.bun/bin/"*; do
  xattr -dr com.apple.quarantine "$bin" 2>/dev/null || true
done
echo "  done"

# Build PATH for launchd (inherits nothing from shell)
CLAUDE_DIR=""
if [ -n "$CLAUDE" ]; then
  CLAUDE_DIR="$(dirname "$CLAUDE"):"
fi
LAUNCHD_PATH="${CLAUDE_DIR}$(dirname "$BUN"):$(dirname "$NPM"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

# ── Workspaces git repo ───────────────────────────────────────────────────────

WORKSPACES="$REPO/workspaces"
if [ ! -d "$WORKSPACES/.git" ]; then
  echo "Initialising workspaces git repo..."
  git -C "$WORKSPACES" init -b main

  # LFS for binary blobs (SQLite DB, media)
  if command -v git-lfs &>/dev/null; then
    git -C "$WORKSPACES" lfs install --local
    cat > "$WORKSPACES/.gitattributes" <<'ATTRS'
*.db  filter=lfs diff=lfs merge=lfs -text
*.db-wal filter=lfs diff=lfs merge=lfs -text
*.db-shm filter=lfs diff=lfs merge=lfs -text
*.png filter=lfs diff=lfs merge=lfs -text
*.jpg filter=lfs diff=lfs merge=lfs -text
*.jpeg filter=lfs diff=lfs merge=lfs -text
*.webp filter=lfs diff=lfs merge=lfs -text
*.mp4 filter=lfs diff=lfs merge=lfs -text
ATTRS
    echo "  git-lfs configured"
  else
    echo "  WARNING: git-lfs not found — install with: brew install git-lfs"
  fi

  cat > "$WORKSPACES/.gitignore" <<'GITIGNORE'
# Ignore sub-repos (each manages its own history)
helloam-www/

# Vault secrets never go in git
vault/

# Task workspace artifacts
am-board/
cards/
GITIGNORE

  git -C "$WORKSPACES" add .gitattributes .gitignore memory/ 2>/dev/null || true
  git -C "$WORKSPACES" commit -m "init: workspaces user repo with lfs" 2>/dev/null || true
  echo "  workspaces repo initialised"
else
  echo "  workspaces repo already exists — skipping init"
fi

# ── am.board (prod — port $PROD_PORT) ────────────────────────────────────────

cat > "$LAUNCH_AGENTS/am.board.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>am.board</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>cd $REPO/board && $NPM run start</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$LAUNCHD_PATH</string>
        <key>HOME</key>
        <string>$HOME_DIR</string>
        <key>USER</key>
        <string>$USER_NAME</string>
        <key>PORT</key>
        <string>$PROD_PORT</string>
        <key>DB_PATH</key>
        <string>$REPO/board/board.db</string>
        <key>WS_URL</key>
        <string>http://localhost:$WS_PORT</string>
        <key>NEXT_PUBLIC_WS_URL</key>
        <string>ws://localhost:$WS_PORT</string>
        <key>NEXT_PUBLIC_BASE_URL</key>
        <string>$PROD_URL</string>
        <key>BOARD_URL</key>
        <string>$PROD_URL</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/am-board.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/am-board.log</string>
</dict>
</plist>
EOF

# ── am.board.dev (dev — port $DEV_PORT) ──────────────────────────────────────

cat > "$LAUNCH_AGENTS/am.board.dev.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>am.board.dev</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>cd $REPO/board && NEXT_DIST_DIR=.next-dev $NPM run dev</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$LAUNCHD_PATH</string>
        <key>HOME</key>
        <string>$HOME_DIR</string>
        <key>USER</key>
        <string>$USER_NAME</string>
        <key>PORT</key>
        <string>$DEV_PORT</string>
        <key>DB_PATH</key>
        <string>$REPO/board/board.db</string>
        <key>WS_URL</key>
        <string>http://localhost:$WS_PORT</string>
        <key>NEXT_PUBLIC_WS_URL</key>
        <string>ws://localhost:$WS_PORT</string>
        <key>NEXT_PUBLIC_BASE_URL</key>
        <string>$DEV_URL</string>
        <key>BOARD_URL</key>
        <string>$DEV_URL</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/am-board-dev.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/am-board-dev.log</string>
</dict>
</plist>
EOF

# ── am.ws-server ──────────────────────────────────────────────────────────────

cat > "$LAUNCH_AGENTS/am.ws-server.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>am.ws-server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$BUN</string>
        <string>run</string>
        <string>$REPO/bin/ws-server</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$LAUNCHD_PATH</string>
        <key>HOME</key>
        <string>$HOME_DIR</string>
        <key>WS_PORT</key>
        <string>$WS_PORT</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/am-ws-server.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/am-ws-server.log</string>
</dict>
</plist>
EOF

# ── am.dispatcher ─────────────────────────────────────────────────────────────

cat > "$LAUNCH_AGENTS/am.dispatcher.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>am.dispatcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>$BUN</string>
        <string>run</string>
        <string>$REPO/bin/dispatcher</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$REPO</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$LAUNCHD_PATH</string>
        <key>HOME</key>
        <string>$HOME_DIR</string>
        <key>USER</key>
        <string>$USER_NAME</string>
        <key>BOARD_URL</key>
        <string>$PROD_URL</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/am-dispatcher.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/am-dispatcher.log</string>
</dict>
</plist>
EOF

# ── am.reflection (nightly at 02:00) ─────────────────────────────────────────

BASH_BIN="$(which bash)"
sed \
  -e "s|__REPO__|$REPO|g" \
  -e "s|__BASH__|$BASH_BIN|g" \
  -e "s|__LAUNCHD_PATH__|$LAUNCHD_PATH|g" \
  -e "s|__HOME__|$HOME_DIR|g" \
  "$REPO/launchagents/am.reflection.plist" > "$LAUNCH_AGENTS/am.reflection.plist"

# ── Load ──────────────────────────────────────────────────────────────────────

GUI_UID=$(id -u)
for LABEL in am.board am.board.dev am.ws-server am.dispatcher am.reflection; do
  launchctl bootout "gui/$GUI_UID/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$GUI_UID" "$LAUNCH_AGENTS/$LABEL.plist"
  echo "loaded $LABEL"
done

echo ""
echo "done"
echo "  prod:  $PROD_URL"
echo "  dev:   $DEV_URL"
echo "  logs:  /tmp/am-board.log  /tmp/am-board-dev.log  /tmp/am-ws-server.log"

# ── Open browser once board is ready ─────────────────────────────────────────
echo ""
echo "Waiting for board to be ready..."
for i in $(seq 1 60); do
  if curl -sf "$PROD_URL" >/dev/null 2>&1; then
    echo "Board is ready — opening $PROD_URL"
    open "$PROD_URL"
    break
  fi
  sleep 2
done
