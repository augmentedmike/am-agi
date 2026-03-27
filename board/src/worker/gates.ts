/**
 * gates.ts — Deterministic gate worker for Kanban state transitions.
 *
 * Pure functions only. No side effects other than filesystem reads and
 * running `bun test`. The API server calls checkGate before applying
 * any card move.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Returns true if the worktree has code changes vs main (non-md, non-workspace files).
 * Writing/research tasks produce no code changes and should not run tests.
 */
function hasCodeChanges(workDir: string): boolean {
  const result = spawnSync("git", ["diff", "main", "origin/main", "HEAD", "--name-only"], {
    cwd: workDir, encoding: "utf8", timeout: 10_000,
  });
  if (result.status !== 0) {
    // Can't determine — fall back to running tests
    return true;
  }
  const files = (result.stdout ?? "").split("\n").filter(Boolean);
  const workspaceFiles = ["research.md", "criteria.md", "todo.md", "work.md"];
  return files.some(f =>
    !f.endsWith(".md") &&
    !workspaceFiles.includes(f) &&
    !f.startsWith("iter/") &&
    !f.startsWith("apps/") &&
    !f.startsWith(".next/")
  );
}

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
  const attachments = card.attachments ?? [];
  const matches = attachments.filter((p) => p.endsWith("/" + name) || p === name || p.endsWith(name));
  // Prefer a match that actually exists on disk
  return matches.find((p) => existsSync(p)) ?? matches[0];
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
  const entries = readdirSync(iterDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => parseInt(e.name, 10))
    .filter((n) => !isNaN(n));
  return entries.length > 0 ? Math.max(...entries) : 0;
}

/** Returns true if bun test exits 0 in workDir. */
function testsPass(workDir: string): boolean {
  // Extend PATH so the bun binary is found even when the server was started
  // without ~/.bun/bin in its PATH (common when launched via launchctl/systemd).
  const bunDir = "/Users/michaeloneal/.bun/bin";
  const existingPath = process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin";
  const env = { ...process.env, PATH: `${bunDir}:${existingPath}` };
  const result = spawnSync("bun", ["test"], {
    cwd: workDir,
    stdio: "pipe",
    timeout: 120_000,
    env,
  });
  return result.status === 0;
}

/** Returns true if criteria.md contains at least one numbered item (`1. ...`). */
function criteriaHasNumberedItems(criteriaPath: string): boolean {
  const content = readFile(criteriaPath);
  return content.split("\n").some((line) => /^\d+\./.test(line.trim()));
}

/**
 * Returns true if research.md satisfies the content requirements:
 * - Contains a file path reference (`src/`) → code research
 * - OR contains a URL (`http`) → non-code research
 */
function researchHasReferences(researchPath: string): boolean {
  const content = readFile(researchPath);
  return content.includes("src/") || content.includes("http");
}

/**
 * Returns true if workDir contains any *.test.ts, *.test.tsx, or *.spec.ts files
 * (excluding node_modules).
 */
function hasTestFiles(dir: string): boolean {
  const pattern = /\.(test|spec)\.(ts|tsx)$/;
  function scan(d: string): boolean {
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true }) as import('node:fs').Dirent[];
    } catch {
      return false;
    }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith(".")) {
        if (scan(join(d, e.name))) return true;
      } else if (e.isFile() && pattern.test(e.name)) {
        return true;
      }
    }
    return false;
  }
  return scan(dir);
}

/**
 * Returns violation messages if docs/CODE_QUALITY.md exists and any of its
 * "never do" patterns appear in `git diff main...HEAD`.
 */
function codeQualityViolations(workDir: string): string[] {
  const qualityPath = join(workDir, "docs", "CODE_QUALITY.md");
  if (!existsSync(qualityPath)) return [];

  const content = readFileSync(qualityPath, "utf8");

  // Extract backtick-quoted patterns from lines that contain "never" (case-insensitive)
  const neverLines = content.split("\n").filter((l) => /\bnever\b/i.test(l));
  const patterns: string[] = [];
  for (const line of neverLines) {
    const matches = line.match(/`([^`]+)`/g);
    if (matches) {
      patterns.push(...matches.map((m) => m.slice(1, -1)));
    }
  }

  if (patterns.length === 0) return [];

  const result = spawnSync("git", ["diff", "main...HEAD"], {
    cwd: workDir,
    stdio: "pipe",
  });

  if (result.status !== 0 || !result.stdout) return [];

  const diff = result.stdout.toString();
  const addedLines = diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .join("\n");

  const violations: string[] = [];
  for (const pattern of patterns) {
    if (addedLines.includes(pattern)) {
      violations.push(`CODE_QUALITY.md violation: \`${pattern}\` found in git diff`);
    }
  }

  return violations;
}

/** Returns true if all criterion lines in criteria.md are verified in agent.log. */
function criteriaVerified(criteriaPath: string, agentLogPath: string): boolean {
  if (!existsSync(criteriaPath) || !existsSync(agentLogPath)) return false;
  const criteria = readFile(criteriaPath);
  const log = readFile(agentLogPath);

  // Extract criterion lines — lines that start with `- ` (bullet) or `N. ` (numbered)
  const criterionLines = criteria
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => (l.startsWith("- ") && l.length > 2) || /^\d+\.\s/.test(l))
    .map((l) => l.startsWith("- ") ? l.slice(2).trim() : l.replace(/^\d+\.\s+/, "").trim());

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
    // Title must be non-empty
    if (!card.title || !card.title.trim()) {
      failures.push("card title must be non-empty");
    }

    // criteria.md: attached, exists, non-empty, has numbered items
    const criteriaPath = fileAttached(card, "criteria.md");
    if (!fileExists(criteriaPath)) {
      failures.push("criteria.md must be attached and exist");
    } else if (!fileNonEmpty(criteriaPath)) {
      failures.push("criteria.md must be non-empty");
    } else if (!criteriaHasNumberedItems(criteriaPath!)) {
      failures.push("criteria.md must contain at least one numbered criterion (1. ...)");
    }

    // research.md: attached, exists, non-empty, has file paths or URLs
    const researchPath = fileAttached(card, "research.md");
    if (!fileExists(researchPath)) {
      failures.push("research.md must be attached and exist");
    } else if (!fileNonEmpty(researchPath)) {
      failures.push("research.md must be non-empty");
    } else if (!researchHasReferences(researchPath!)) {
      failures.push(
        "research.md must contain at least one file path (src/...) for code tasks or URL (http...) for non-code tasks",
      );
    }
  }

  // -------------------------------------------------------------------------
  // in-progress → in-review
  // -------------------------------------------------------------------------
  else if (from === "in-progress" && to === "in-review") {
    const todoPath = fileAttached(card, "todo.md");
    if (!fileExists(todoPath)) {
      failures.push("todo.md must be attached and exist");
    } else if (!todoComplete(todoPath!)) {
      failures.push("todo.md has unchecked items — all steps must be complete before review");
    }

    // Run bun test only if test files exist and there are code changes in workDir
    if (failures.length === 0 && workDir && hasTestFiles(workDir) && hasCodeChanges(workDir)) {
      if (!testsPass(workDir)) {
        failures.push("bun test failed — all tests must pass before moving to review");
      }
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

    // Check CODE_QUALITY.md violations
    if (failures.length === 0) {
      const violations = codeQualityViolations(workDir);
      failures.push(...violations);
    }

    // Run tests last — most expensive check (only if test files exist and there are code changes)
    if (failures.length === 0 && workDir && hasTestFiles(workDir) && hasCodeChanges(workDir)) {
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
  // in-progress → backlog (move back if started prematurely — always allowed)
  // -------------------------------------------------------------------------
  else if (from === "in-progress" && to === "backlog") {
    // No gate. Always allowed — card is returned to backlog for future work.
  }

  // -------------------------------------------------------------------------
  // shipped → in-progress (reopen route — always allowed)
  // -------------------------------------------------------------------------
  else if (from === "shipped" && to === "in-progress") {
    // No gate. Always allowed.
  }

  // -------------------------------------------------------------------------
  // Invalid or unknown transition
  // -------------------------------------------------------------------------
  else {
    const validForward = ["backlog→in-progress", "in-progress→in-review", "in-review→shipped", "in-review→in-progress", "in-progress→backlog", "shipped→in-progress"];
    failures.push(
      `invalid transition: ${from} → ${to}. Valid transitions: ${validForward.join(", ")}`,
    );
  }

  return { allowed: failures.length === 0, failures };
}
