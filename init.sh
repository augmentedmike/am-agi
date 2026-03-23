#!/usr/bin/env bash
# Agent bootstrap — run this at the start of every session to ensure the
# environment is configured before invoking any CLI commands.

AM_DIR="$HOME/am"
EXPORTS=(
  "export PATH=\"$AM_DIR/bin:\$PATH\""
)

RC_FILE="$HOME/.zshrc"
if [[ "$SHELL" == */bash ]]; then
  RC_FILE="$HOME/.bashrc"
fi

echo "Configuring environment in $RC_FILE"
echo

added=0

for line in "${EXPORTS[@]}"; do
  if grep -qF "$line" "$RC_FILE" 2>/dev/null; then
    echo "  already set: $line"
  else
    printf "\n# am\n%s\n" "$line" >> "$RC_FILE"
    echo "  added: $line"
    added=$((added + 1))
  fi
done

echo

if [[ $added -gt 0 ]]; then
  echo "Done. Reload your shell or run:"
  echo
  echo "  source $RC_FILE"
  echo
else
  echo "Nothing to do — already configured."
fi
