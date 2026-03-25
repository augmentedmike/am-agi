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
