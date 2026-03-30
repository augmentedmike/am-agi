# Memory System

AM has two memory tiers: **short-term (ST)** and **long-term (LT)**.

| Tier | Storage | Lifetime | When to use |
|------|---------|----------|-------------|
| ST | Markdown files in `workspaces/memory/st/` | Until archived | Rules, lessons, "never do X" |
| LT | SQLite FTS5 at `workspaces/memory/lt/memory.db` | Permanent | Facts, decisions, context |

Agents always read all ST memories. LT memories are retrieved by ranked search.

---

## Commands

### `memory add`

```sh
memory add "content" [--st|--lt] [--topic <slug>]
```

Save a memory. Auto-routes to ST vs LT if neither flag is given; rules/lessons go ST, facts go LT.

```sh
memory add "never use git stash — commits only" --st
memory add "blog domain is blog.helloam.bot" --lt --topic blog
memory add "Qwen3-Coder-30B-A3B is the primary model" --lt --topic models
```

---

### `memory recall`

```sh
memory recall "query" [--limit <n>]
```

Retrieves relevant memories. Always returns all ST entries plus ranked LT results. Default limit: 10.

```sh
memory recall "git workflow rules"
memory recall "which model to use" --limit 5
```

---

### `memory list`

```sh
memory list [--st|--lt]
```

List all memory entries. Without flags, lists both tiers.

```sh
memory list       # all memories
memory list --st  # short-term only
memory list --lt  # long-term only
```

---

### `memory rm`

```sh
memory rm <slug-or-id>
```

Delete a single memory entry by its slug (ST) or numeric ID (LT).

```sh
memory rm feedback_no_git_stash
memory rm 42
```

---

## When agents use memory

Agents run `memory recall` at the start of every iteration, seeding with the first 5 lines of `todo.md`. This surfaces relevant lessons before any code is written.

If a task reveals a new constraint or mistake, agents run:

```sh
memory add --st "lesson from this task"
```

immediately before committing — so the next iteration inherits it.
