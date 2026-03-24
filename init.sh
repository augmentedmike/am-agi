#!/usr/bin/env bash
# Agent bootstrap — source this to configure the current session.
# Does not modify the machine.
#
#   source ./init.sh

export PATH="$HOME/am/bin:$PATH"

# Resolve the repo root (works whether sourced from any directory)
_AM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Populate bin/ from committed scripts
mkdir -p "$_AM_ROOT/bin"
cp "$_AM_ROOT/scripts/board.ts" "$_AM_ROOT/bin/board"
chmod +x "$_AM_ROOT/bin/board"
cp "$_AM_ROOT/scripts/new-next.ts" "$_AM_ROOT/bin/new-next"
chmod +x "$_AM_ROOT/bin/new-next"
cp "$_AM_ROOT/scripts/dispatcher.ts" "$_AM_ROOT/bin/dispatcher"
chmod +x "$_AM_ROOT/bin/dispatcher"

# Add local bin/ to PATH so `board` and `new-next` resolve
export PATH="$_AM_ROOT/bin:$PATH"

unset _AM_ROOT
