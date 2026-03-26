#!/usr/bin/env bash
# Agent bootstrap — source this to configure the current session.
# Does not modify the machine.
#
#   source ./init.sh

export PATH="$HOME/am/bin:$PATH"

# Resolve the repo root (works whether sourced from any directory)
_AM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Make bin/ commands executable and add to PATH
chmod +x "$_AM_ROOT/bin/"* 2>/dev/null || true
export PATH="$_AM_ROOT/bin:$PATH"

unset _AM_ROOT

# ── Quick reference ────────────────────────────────────────────────────────────
# Fresh install:   bash launchagents/install.sh
#
# Board servers:
#   dev  (4221) — am.board.dev LaunchAgent, turbopack hot-reload, for agents
#   prod (4220) — am.board LaunchAgent, compiled next start, for humans
#
# Deploy to prod:  board-deploy    (build + reload am.board — called by ship hook)
# Dev hot-reloads automatically — no deploy needed
#
# Logs:
#   tail -f /tmp/am-board.log        (prod)
#   tail -f /tmp/am-board-dev.log    (dev)
#
# Force reload:
#   launchctl kickstart -k gui/$(id -u)/am.board      (prod)
#   launchctl kickstart -k gui/$(id -u)/am.board.dev  (dev)
