/**
 * gates.ts — Deterministic gate worker for Kanban state transitions.
 *
 * Pure functions only. No side effects other than filesystem reads and
 * running `bun test`. The API server calls checkGate before applying
 * any card move.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type State = "backlog" | "in-progress" | "in-review" | "shipped";

export interface Card {
  id: string;
  title: string;
  state: State;
  priority: string;
  attachments?: string[];
  /** Iteration number (1-based). Derived from iter/ directory count. */
  iteration?: number;
}

export interface GateResult {
  allowed: boolean;
  failures: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileAttached(card: Card, name: string): string | undefined {
  return (card.attachments ?? []).find((p) => p.endsWith(name) || p === name);
}

function fileExists(path: string | undefined): boolean {
  return !!path && existsSync(path);
}

function fileNonEmpty(path: string | undefined): boolean {
  if (!path || !existsSync(path)) return false;
  const content = readFileSync(path, "utf8").trim();
  return content.length > 0;
}

function readFile(path: string): string {
  return readFileSync(path, "utf8");
}

/** Returns true if todo.md has no unchecked items (no `- [ ]` lines). */
function todoComplete(todoPath: string): boolean {
  if (!existsSync(todoPath)) return false;
  const content = readFile(todoPath);
  return !content.includes("- [ ]");
}

/** Returns the current iteration number from the iter/ directory. */
function currentIteration(workDir: string): number {
  const iterDir = join(workDir, "iter");
  if (!existsSync(iterDir)) return 0;
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const entries = readdirSync(iterDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => parseInt(e.name, 10))
    .filter((n) => !isNaN(n));
  return entries.length > 0 ? Math.max(...entries) : 0;
}

/** Returns true if bun test exits 0 in workDir. */
function testsPass(workDir: string): boolean {
  const result = spawnSync("bun", ["test"], {
    cwd: workDir,
    stdio: "pipe",
    timeout: 120_000,
  });
  return result.status === 0;
}

/** Returns true if all criterion lines in criteria.md are verified in agent.log. */
function criteriaVerified(criteriaPath: string, agentLogPath: string): boolean {
  if (!existsSync(criteriaPath) || !existsSync(agentLogPath)) return false;
  const criteria = readFile(criteriaPath);
  const log = readFile(agentLogPath);

  // Extract criterion lines — lines that start with `- ` (list items)
  const criterionLines = criteria
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ") && l.length > 2)
    .map((l) => l.slice(2).trim());

  if (criterionLines.length === 0) return false;

  for (const criterion of criterionLines) {
    // Check for ✓ or [pass] near a reference to the criterion text
    const escaped = criterion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const passPattern = new RegExp(`(✓|\\[pass\\]).*${escaped}|${escaped}.*(✓|\\[pass\\])`, "i");
    if (!passPattern.test(log)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Gate definitions
// ---------------------------------------------------------------------------

/**
 * Check whether a transition from `from` to `to` is allowed for `card`.
 *
 * @param from     Current state of the card
 * @param to       Requested target state
 * @param card     Full card data (including attachments)
 * @param workDir  Absolute path to the card's working directory
 */
export async function checkGate(
  from: State,
  to: State,
  card: Card,
  workDir: string,
): Promise<GateResult> {
  const failures: string[] = [];

  // -------------------------------------------------------------------------
  // backlog → in-progress
  // -------------------------------------------------------------------------
  if (from === "backlog" && to === "in-progress") {
    const criteriaPath = fileAttached(card, "criteria.md");
    if (!fileExists(criteriaPath)) {
      failures.push("criteria.md must be attached and exist");
    } else if (!fileNonEmpty(criteriaPath)) {
      failures.push("criteria.md must be non-empty");
    }

    const todoPath = fileAttached(card, "todo.md");
    if (!fileExists(todoPath)) {
      failures.push("todo.md must be attached and exist");
    } else if (!fileNonEmpty(todoPath)) {
      failures.push("todo.md must be non-empty");
    }
  }

  // -------------------------------------------------------------------------
  // in-progress → in-review
  // -------------------------------------------------------------------------
  else if (from === "in-progress" && to === "in-review") {
    const todoPath = fileAttached(card, "todo.md");
    if (!fileExists(todoPath)) {
      failures.push("todo.md must be attached and exist");
    } else if (!todoComplete(todoPath)) {
      failures.push("todo.md has unchecked items — all steps must be complete before review");
    }
  }

  // -------------------------------------------------------------------------
  // in-review → shipped
  // -------------------------------------------------------------------------
  else if (from === "in-review" && to === "shipped") {
    const n = currentIteration(workDir);
    if (n === 0) {
      failures.push("no iteration directory found in iter/");
    } else {
      const agentLogPath = join(workDir, "iter", String(n), "agent.log");
      if (!existsSync(agentLogPath)) {
        failures.push(`iter/${n}/agent.log does not exist`);
      } else {
        const criteriaPath = fileAttached(card, "criteria.md");
        if (!fileExists(criteriaPath)) {
          failures.push("criteria.md must be attached and exist");
        } else if (!criteriaVerified(criteriaPath!, agentLogPath)) {
          failures.push(
            "not all criteria are verified in the latest agent.log (need ✓ or [pass] for each criterion)",
          );
        }
      }
    }

    // Run tests last — most expensive check
    if (failures.length === 0) {
      if (!testsPass(workDir)) {
        failures.push("bun test failed — all tests must pass before shipping");
      }
    }
  }

  // -------------------------------------------------------------------------
  // in-review → in-progress (failure route — always allowed)
  // -------------------------------------------------------------------------
  else if (from === "in-review" && to === "in-progress") {
    // No gate. Always allowed.
  }

  // -------------------------------------------------------------------------
  // Invalid or unknown transition
  // -------------------------------------------------------------------------
  else {
    const validForward = ["backlog→in-progress", "in-progress→in-review", "in-review→shipped", "in-review→in-progress"];
    failures.push(
      `invalid transition: ${from} → ${to}. Valid transitions: ${validForward.join(", ")}`,
    );
  }

  return { allowed: failures.length === 0, failures };
}
