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
WS_PORT=4221

# Detect binaries
NPM=$(which npm || echo "/opt/homebrew/opt/node@24/bin/npm")
BUN=$(which bun || echo "$HOME_DIR/.bun/bin/bun")
CLAUDE=$(which claude 2>/dev/null || echo "$HOME_DIR/.local/bin/claude")

# Warn if 'claude' is a shell alias — launchd won't see aliases, needs the real binary
if type claude 2>/dev/null | grep -q "alias"; then
  echo "⚠️  WARNING: 'claude' is a shell alias in your current shell."
  echo "   launchd does not inherit shell aliases. The real binary will be used:"
  echo "   $CLAUDE"
  echo "   If this path is wrong, set CLAUDE=/path/to/claude before running install.sh"
  echo ""
fi

echo "Repo:   $REPO"
echo "npm:    $NPM"
echo "bun:    $BUN"
echo "claude: $CLAUDE"
echo "Ports:  prod=$PROD_PORT  dev=$DEV_PORT"

# ── Strip macOS quarantine from bun binaries ─────────────────────────────────
# Without this, every bun worker spawn triggers a macOS security popup.
echo "Stripping quarantine from bun binaries..."
for bin in "$HOME_DIR/.bun/bin/"*; do
  xattr -dr com.apple.quarantine "$bin" 2>/dev/null || true
done
echo "  done"

# Build PATH for launchd (inherits nothing from shell)
LAUNCHD_PATH="$(dirname "$CLAUDE"):$(dirname "$BUN"):$(dirname "$NPM"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

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
        <key>WS_URL</key>
        <string>http://localhost:$WS_PORT</string>
        <key>NEXT_PUBLIC_WS_URL</key>
        <string>ws://localhost:$WS_PORT</string>
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
        <string>cd $REPO/board && $NPM run dev</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$LAUNCHD_PATH</string>
        <key>HOME</key>
        <string>$HOME_DIR</string>
        <key>USER</key>
        <string>$USER_NAME</string>
        <key>WS_URL</key>
        <string>http://localhost:$WS_PORT</string>
        <key>NEXT_PUBLIC_WS_URL</key>
        <string>ws://localhost:$WS_PORT</string>
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
        <string>http://localhost:$PROD_PORT</string>
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

# ── Load ──────────────────────────────────────────────────────────────────────

GUI_UID=$(id -u)
for LABEL in am.board am.board.dev am.ws-server am.dispatcher; do
  launchctl bootout "gui/$GUI_UID/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$GUI_UID" "$LAUNCH_AGENTS/$LABEL.plist"
  echo "loaded $LABEL"
done

echo ""
echo "done"
echo "  prod:  http://localhost:$PROD_PORT"
echo "  dev:   http://localhost:$DEV_PORT"
echo "  logs:  /tmp/am-board.log  /tmp/am-board-dev.log  /tmp/am-ws-server.log"

# ── Open browser once board is ready ─────────────────────────────────────────
echo ""
echo "Waiting for board to be ready..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:4220 >/dev/null 2>&1; then
    echo "Board is ready — opening http://localhost:4220"
    open http://localhost:4220
    break
  fi
  sleep 2
done
