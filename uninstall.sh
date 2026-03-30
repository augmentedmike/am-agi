#!/usr/bin/env bash
# uninstall.sh — remove AM background services
#
# Does NOT delete databases, workspaces, or any user data.
# Run this to stop AM from auto-starting at login.

set -e

OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM="mac" ;;
  Linux)  PLATFORM="linux" ;;
  *)
    echo "ERROR: unsupported platform: $OS"
    echo "Windows users: run uninstall.ps1 instead"
    exit 1
    ;;
esac

echo "AM uninstall"
echo "Platform: $PLATFORM"
echo ""

if [ "$PLATFORM" = "mac" ]; then
  GUI_UID=$(id -u)
  for LABEL in am.board am.board.dev am.ws-server am.dispatcher; do
    if launchctl list "$LABEL" >/dev/null 2>&1; then
      launchctl bootout "gui/$GUI_UID/$LABEL" 2>/dev/null || true
      echo "  unloaded $LABEL"
    fi
    PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
    if [ -f "$PLIST" ]; then
      rm "$PLIST"
      echo "  removed $PLIST"
    fi
  done

else
  # systemd
  if systemctl --user status >/dev/null 2>&1; then
    for SVC in am-board am-ws-server am-dispatcher; do
      if systemctl --user is-enabled "$SVC.service" >/dev/null 2>&1; then
        systemctl --user stop "$SVC.service" 2>/dev/null || true
        systemctl --user disable "$SVC.service" 2>/dev/null || true
        echo "  stopped + disabled $SVC"
      fi
      UNIT="$HOME/.config/systemd/user/$SVC.service"
      if [ -f "$UNIT" ]; then
        rm "$UNIT"
        echo "  removed $UNIT"
      fi
    done
    systemctl --user daemon-reload
  fi

  # profile-based fallback launcher
  LAUNCHER="$HOME/.am/launch.sh"
  if [ -f "$LAUNCHER" ]; then
    # Kill any running processes it started
    pkill -f "am/board" 2>/dev/null || true
    pkill -f "bin/ws-server" 2>/dev/null || true
    pkill -f "bin/dispatcher" 2>/dev/null || true
    rm "$LAUNCHER"
    echo "  removed $LAUNCHER"
  fi

  # Remove the ~/.profile hook
  if grep -q "# am-services" "$HOME/.profile" 2>/dev/null; then
    sed -i '/# am-services/,+1d' "$HOME/.profile"
    echo "  removed am-services hook from ~/.profile"
  fi
fi

echo ""
echo "Done. Services removed."
echo "Databases and workspaces are untouched."
