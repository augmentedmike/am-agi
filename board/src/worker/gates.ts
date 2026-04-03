/**
 * gates.ts — Deterministic gate worker for Kanban state transitions.
 *
 * Pure functions only. No side effects other than filesystem reads and
 * running `bun test`. The API server calls checkGate before applying
 * any card move.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AM_BOARD_PROJECT_ID } from "../lib/constants";

const execFileAsync = promisify(execFile);

/**
 * Returns true if the worktree has code changes vs main (non-md, non-workspace files).
 * Writing/research tasks produce no code changes and should not run tests.
 */
async function hasCodeChanges(workDir: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["diff", "main", "origin/main", "HEAD", "--name-only"], {
      cwd: workDir, encoding: "utf8", timeout: 10_000,
    });
    const files = (stdout ?? "").split("\n").filter(Boolean);
    const workspaceFiles = ["research.md", "criteria.md", "todo.md", "work.md"];
    return files.some(f =>
      !f.endsWith(".md") &&
      !workspaceFiles.includes(f) &&
      !f.startsWith("iter/") &&
      !f.startsWith("apps/") &&
      !f.startsWith(".next/")
    );
  } catch {
    return true; // Can't determine — fall back to running tests
  }
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
  /** If set, this card belongs to an external project. The worktree contains AM repo code — skip bun test. */
  projectId?: string | null;
  /** Titles of dependency cards that are not yet shipped — used by backlog→in-progress gate. */
  unshippedDeps?: string[];
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

/** Run bun test and return the set of failing test names. */
async function runTests(cwd: string, env: NodeJS.ProcessEnv): Promise<Set<string>> {
  // Use absolute paths for test directories to prevent bun from matching
  // tests in nested worktrees (e.g. worktrees/card-1/agent/).
  const args = ["test", join(cwd, "agent"), join(cwd, "scripts")];
  const failures = new Set<string>();
  try {
    await execFileAsync("bun", args, { cwd, timeout: 240_000, env });
  } catch (err) {
    const output = (err as { stdout?: string; stderr?: string }).stderr ?? "";
    // Parse "✗ <test name>" lines from bun test output
    for (const line of output.split("\n")) {
      const m = line.match(/^\s*(?:✗|×|FAIL|fail)\s+(.+)$/);
      if (m) failures.add(m[1].trim());
    }
    // If we can't parse failures, treat any non-zero exit as one failure token
    if (failures.size === 0) failures.add("__unknown__");
  }
  return failures;
}

/** Returns true if unit tests pass. Pre-existing failures on dev/main are
 *  ignored — only NEW failures introduced by this branch block the gate.
 *  *.e2e.test.ts files are excluded — they require real machine state. */
async function testsPass(workDir: string): Promise<boolean> {
  const bunDir = "/Users/michaeloneal/.bun/bin";
  const existingPath = process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin";
  const env = { ...process.env, PATH: `${bunDir}:${existingPath}` };

  const branchFailures = await runTests(workDir, env);
  if (branchFailures.size === 0) return true;

  // Some tests failed — check if they were already failing on dev (merge-base).
  // Use a throw-away worktree so we never touch the card's working tree.
  let mergeBase: string;
  try {
    const { stdout } = await execFileAsync("git", ["merge-base", "HEAD", "origin/dev"], { cwd: workDir });
    mergeBase = stdout.trim();
  } catch {
    return false;
  }

  const tmpWorktree = join(workDir, "..", `__baseline-${Date.now()}`);
  try {
    await execFileAsync("git", ["worktree", "add", "--detach", tmpWorktree, mergeBase], { cwd: workDir });
    const baselineFailures = await runTests(tmpWorktree, env);
    const newFailures = [...branchFailures].filter(f => !baselineFailures.has(f));
    return newFailures.length === 0;
  } finally {
    try {
      await execFileAsync("git", ["worktree", "remove", "--force", tmpWorktree], { cwd: workDir });
    } catch {
      // git worktree remove failed — nuke the directory and prune the ref
      try { await execFileAsync("rm", ["-rf", tmpWorktree]); } catch {}
      try { await execFileAsync("git", ["worktree", "prune"], { cwd: workDir }); } catch {}
    }
  }
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
async function codeQualityViolations(workDir: string): Promise<string[]> {
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

  let diffOutput: string;
  try {
    const { stdout } = await execFileAsync("git", ["diff", "main...HEAD"], { cwd: workDir });
    diffOutput = stdout;
  } catch {
    return [];
  }
  if (!diffOutput) return [];
  const diff = diffOutput;
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

  // Count criterion lines — lines that start with `- ` (bullet) or `N. ` (numbered)
  const criteriaCount = criteria
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => (l.startsWith("- ") && l.length > 2) || /^\d+\.\s/.test(l))
    .length;

  if (criteriaCount === 0) return false;

  // Count pass lines in agent.log — any line containing ✓ or [pass].
  // Agents write paraphrased summaries, not verbatim criterion text, so we
  // count rather than text-match. One pass line per criterion is required.
  const passCount = log
    .split("\n")
    .filter((l) => l.includes("✓") || /\[pass\]/i.test(l))
    .length;

  return passCount >= criteriaCount;
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

    // Dependency check: all dependencies must be shipped
    if (card.unshippedDeps && card.unshippedDeps.length > 0) {
      for (const title of card.unshippedDeps) {
        failures.push(`dependency not yet shipped: "${title}"`);
      }
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

    // Require at least one iteration log — proves the agent loop actually ran during in-progress.
    if (workDir) {
      const n = currentIteration(workDir);
      if (n === 0) {
        failures.push("no iteration directory found in iter/ — agent loop must run at least once during in-progress");
      } else {
        const agentLogPath = join(workDir, "iter", String(n), "agent.log");
        if (!existsSync(agentLogPath)) {
          failures.push(`iter/${n}/agent.log does not exist — agent loop must write a log before moving to review`);
        }
      }
    }

    // Run bun test only for AM-board cards. External project cards use an AM repo worktree.
    if (failures.length === 0 && card.projectId === AM_BOARD_PROJECT_ID && workDir && hasTestFiles(workDir)) {
      if (!await testsPass(workDir)) {
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
      const violations = await codeQualityViolations(workDir);
      failures.push(...violations);
    }

    // Run tests last — only for AM-board cards. External project cards use an AM repo worktree.
    if (failures.length === 0 && card.projectId === AM_BOARD_PROJECT_ID && workDir && hasTestFiles(workDir)) {
      if (!await testsPass(workDir)) {
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
