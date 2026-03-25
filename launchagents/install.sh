#!/bin/bash
# install.sh — generate and load LaunchAgents for the current user's environment

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="$HOME"
USER_NAME="$(whoami)"
LAUNCH_AGENTS="$HOME_DIR/Library/LaunchAgents"

# Detect binaries
NPM=$(which npm || echo "/opt/homebrew/opt/node@24/bin/npm")
BUN=$(which bun || echo "$HOME_DIR/.bun/bin/bun")
CLAUDE=$(which claude 2>/dev/null || echo "$HOME_DIR/.local/bin/claude")

echo "Repo:   $REPO"
echo "npm:    $NPM"
echo "bun:    $BUN"
echo "claude: $CLAUDE"

# Build PATH for launchd (inherits nothing from shell)
LAUNCHD_PATH="$(dirname "$CLAUDE"):$(dirname "$BUN"):$(dirname "$NPM"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

# ── am.board ────────────────────────────────────────────────────────────────

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
        <string>lsof -ti tcp:4200 | xargs kill -9 2>/dev/null; cd $REPO/board && $NPM run dev</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$LAUNCHD_PATH</string>
        <key>HOME</key>
        <string>$HOME_DIR</string>
        <key>USER</key>
        <string>$USER_NAME</string>
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

# ── am.dispatcher ────────────────────────────────────────────────────────────

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
        <string>http://localhost:4200</string>
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

# ── Load ─────────────────────────────────────────────────────────────────────

GUI_UID=$(id -u)
for LABEL in am.board am.dispatcher; do
  launchctl bootout "gui/$GUI_UID/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$GUI_UID" "$LAUNCH_AGENTS/$LABEL.plist"
  echo "loaded $LABEL"
done

echo "done — logs: /tmp/am-board.log /tmp/am-dispatcher.log"
