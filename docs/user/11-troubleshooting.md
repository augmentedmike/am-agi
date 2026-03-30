# Troubleshooting

---

## Gate rejection errors

When `board move` is rejected, the specific failures are printed. Address each one and retry.

### `criteria.md not found`

The card cannot move from `backlog → in-progress` until `criteria.md` exists.

```sh
# Fix: create criteria.md in the worktree
cat > criteria.md << 'EOF'
# Acceptance Criteria: <Title>

1. <First binary criterion>
2. <Second binary criterion>
EOF
board move <id> in-progress
```

### `unchecked items in todo.md`

The card cannot move from `in-progress → in-review` while `todo.md` has unchecked items.

```sh
# Fix: check off the remaining items or add them to the next iteration's work
# Then retry
board move <id> in-review
```

### `tests failing`

The card cannot move from `in-review → shipped` while tests fail.

```sh
bun test --timeout 30000
# Read the failure output, fix the code, re-run
board move <id> shipped
```

---

## Common failures

### `board: command not found`

`init.sh` has not been sourced in this terminal session.

```sh
source ./init.sh
```

### `init.sh: No such file or directory`

You're not in the AM project root, or the repo wasn't cloned correctly.

```sh
cd ~/am          # or wherever you cloned it
ls init.sh       # confirm it exists
source ./init.sh
```

### `board move` accepted but dispatcher doesn't pick up the card

Check that `am-dispatcher` is running:

```sh
# macOS
launchctl list | grep am-dispatcher

# Linux
systemctl status am-dispatcher

# Any platform — check the board UI
open http://localhost:4200
```

Restart if needed: `launchctl kickstart -k gui/$UID/am-dispatcher` (macOS).

### `in-review` gate keeps rejecting after all items are checked

One or more criteria in `criteria.md` may not have a corresponding test. Re-read the criteria and confirm each has an implementation and a test that verifies it.

---

## Filing a bug report

**AM tooling bug** (board CLI, gate logic, dispatcher):

```sh
board create --title "Bug: <description>" --priority high
```

Include in the card's `work.md`:
- Steps to reproduce
- Expected vs actual behavior
- Relevant log from `iter/<n>/agent.log`

**AM system bug** (affects all users):

File at [github.com/augmentedmike/am-agi/issues](https://github.com/augmentedmike/am-agi/issues)
