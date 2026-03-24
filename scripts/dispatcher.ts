#!/usr/bin/env bun
/**
 * dispatcher — watches the board API, picks active cards, runs AM iterations.
 *
 * Loop every 5 seconds:
 *   1. GET /api/cards → filter backlog/in-progress/in-review
 *   2. Pick highest-priority card per state
 *   3. For each card: ensure worktree exists, write work.md, run iteration
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// ── Column prompts (inlined to avoid runtime import issues) ──────────────────

const BACKLOG_PROMPT = `
You are working a card in the BACKLOG column. Your job is to make the work concrete before anyone writes a line of code.

1. Read the card: run \`board show <id>\` to get the title, description, and any existing work log.

2. Classify the task:
   - CODE TASK: the card involves writing, editing, or deleting source files.
   - NON-CODE TASK: the card involves research, documentation, design, or other non-implementation work.

3. For CODE tasks — write research.md:
   - Read the relevant source files using Read/Glob/Grep tools.
   - Identify the specific files and line numbers that need to change.
   - research.md must include at least one file path reference (e.g. src/worker/gates.ts:42).

4. For NON-CODE tasks — write research.md:
   - Use web search to gather relevant sources, prior art, and key findings.
   - research.md must include at least one URL (http://... or https://...) or citation.

5. Write criteria.md — a numbered list of acceptance criteria:
   - Format: \`1. <criterion>\`, \`2. <criterion>\`, etc.
   - Each criterion must be a testable, binary outcome (pass/fail, exists/missing).
   - Be specific. Vague criteria ("it works") will block review.

6. Write todo.md — a flat checklist derived from criteria.md:
   - Format: \`- [ ] <step>\` for each step needed to satisfy the criteria.

7. Attach all files to the card:
   \`board update <id> --attach research.md --attach criteria.md --attach todo.md\`

8. Attempt the gate:
   \`board move <id> in-progress\`
   - If the gate rejects, read the failure message, fix the specific issue, and retry.
`.trim();

const IN_PROGRESS_PROMPT = `
You are working a card in the IN-PROGRESS column. Your job is to implement the work defined by criteria.md.

1. Read context:
   - \`board show <id>\` — card title and state
   - criteria.md — the acceptance criteria (numbered list)
   - research.md — file locations and references from backlog
   - todo.md — the current checklist of steps

2. Work through unchecked items in todo.md one at a time:
   - Implement the change.
   - For CODE tasks: write or update tests covering each criterion. Run \`bun test\` before marking any criterion done.
   - Check off the item in todo.md: change \`- [ ]\` to \`- [x]\`.
   - Rewrite todo.md after each item is completed.

3. When all items in todo.md are checked and tests pass:
   \`board move <id> in-review\`

4. If the gate rejects:
   - Read the failure message carefully.
   - Fix the specific issue (unchecked items, failing tests).
   - Retry the move.
`.trim();

const IN_REVIEW_PROMPT = `
You are working a card in the IN-REVIEW column. Your job is adversarial: assume the implementation is wrong and try to prove it.

1. Read context:
   - criteria.md — the acceptance criteria to verify
   - The latest iter/<n>/agent.log — prior verification attempts

2. Verify each criterion independently:
   - Do not assume the implementation works. Read the code, run commands, check outputs.
   - For CODE tasks: run \`bun test\` and check exit code.
   - If docs/CODE_QUALITY.md exists: scan the implementation against its rules. Flag any violations.

3. Write iter/<n+1>/agent.log with one line per criterion:
   - Pass: \`✓ <criterion text>\`
   - Fail: \`✗ <criterion text>: <specific reason it failed>\`

4. If ALL criteria pass:
   \`board move <id> shipped\`

5. If ANY criterion fails:
   \`board move <id> in-progress --log "<concise summary of what failed and why>"\`
   Do not attempt to fix the failures here — that is in-progress work.
`.trim();

// ── Types ────────────────────────────────────────────────────────────────────

type CardState = "backlog" | "in-progress" | "in-review" | "shipped";
type Priority = "critical" | "high" | "normal" | "low";

interface Card {
  id: string;
  title: string;
  state: CardState;
  priority: Priority;
}

// ── Config ───────────────────────────────────────────────────────────────────

const BOARD_URL = process.env.BOARD_URL ?? "http://localhost:3000";
const POLL_INTERVAL_MS = 5_000;
const REPO_ROOT = resolve(import.meta.dir, "..");
const ACTIVE_STATES: CardState[] = ["backlog", "in-progress", "in-review"];

// Priority order (lower index = higher priority)
const PRIORITY_ORDER: Priority[] = ["critical", "high", "normal", "low"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function priorityRank(p: Priority): number {
  return PRIORITY_ORDER.indexOf(p);
}

function columnPrompt(state: CardState): string {
  switch (state) {
    case "backlog":     return BACKLOG_PROMPT;
    case "in-progress": return IN_PROGRESS_PROMPT;
    case "in-review":   return IN_REVIEW_PROMPT;
    default:            return "";
  }
}

function worktreePath(cardId: string): string {
  return resolve(REPO_ROOT, "..", `am-${cardId}`);
}

function ensureWorktree(cardId: string): string {
  const dir = worktreePath(cardId);
  if (!existsSync(dir)) {
    console.log(`[dispatch] creating worktree for ${cardId}`);
    const result = spawnSync(
      "git",
      ["worktree", "add", dir, "-b", cardId],
      { cwd: REPO_ROOT, stdio: "inherit" },
    );
    if (result.status !== 0) {
      throw new Error(`git worktree add failed for ${cardId} (exit ${result.status})`);
    }
  }
  return dir;
}

function writeWorkMd(dir: string, card: Card): void {
  const prompt = columnPrompt(card.state);
  const content = [
    `# Card: ${card.title} (${card.id})`,
    `State: ${card.state}`,
    `Priority: ${card.priority}`,
    "",
    "## Instructions",
    prompt,
  ].join("\n");
  writeFileSync(join(dir, "work.md"), content, "utf-8");
}

async function fetchActiveCards(): Promise<Card[]> {
  const url = `${BOARD_URL}/api/cards`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const data = await res.json() as Card[];
  return data.filter((c) => ACTIVE_STATES.includes(c.state));
}

/** Pick the highest-priority card for each active state. */
function pickCards(cards: Card[]): Card[] {
  const picked: Card[] = [];
  for (const state of ACTIVE_STATES) {
    const inState = cards
      .filter((c) => c.state === state)
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    if (inState.length > 0) picked.push(inState[0]);
  }
  return picked;
}

// ── Main dispatch loop ───────────────────────────────────────────────────────

async function dispatchCycle(): Promise<void> {
  const allActive = await fetchActiveCards();
  const cards = pickCards(allActive);

  for (const card of cards) {
    console.log(`[dispatch] ${card.id} ${card.state}`);
    try {
      const dir = ensureWorktree(card.id);
      writeWorkMd(dir, card);

      // Dynamic import so failures here don't crash the loop
      const { runIteration } = await import(
        resolve(REPO_ROOT, "agent/src/loop/index.ts")
      );
      await runIteration(dir);
    } catch (err) {
      console.error(`[dispatch] error on ${card.id}:`, err);
    }
  }
}

async function main(): Promise<void> {
  console.log(`[dispatch] starting — polling ${BOARD_URL} every ${POLL_INTERVAL_MS / 1000}s`);
  while (true) {
    try {
      await dispatchCycle();
    } catch (err) {
      console.error("[dispatch] cycle error:", err);
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }
}

main();
