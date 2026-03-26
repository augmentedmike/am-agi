import { exec as defaultExec, type ExecFn, type ExecResult } from "../exec.ts";
import { resolve } from "path";
import { existsSync } from "fs";
import { spawn } from "child_process";

export interface CommitIterationOptions {
  cwd?: string;
  execFn?: ExecFn;
}

export interface ShipCardOptions {
  /** Path to the worktree branch dir. Defaults to cwd. */
  cwd?: string;
  /** Path to the repo root (used to checkout main and push). Defaults to cwd. */
  repoRoot?: string;
  execFn?: ExecFn;
  /** Override the board-restart side-effect (useful in tests). */
  restartBoardFn?: () => void;
  /**
   * Called to update the board card with a log message.
   * Used to surface push/step failures to the card before the error propagates.
   */
  boardUpdateFn?: (cardId: string, msg: string) => void;
  /**
   * Override the delay implementation (useful in tests to avoid real sleeps).
   * Defaults to setTimeout-based exponential backoff.
   */
  delayFn?: (ms: number) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateCommitMessage(msg: string): void {
  if (!msg.trim()) {
    throw new Error("commit message must not be empty");
  }
  const subject = msg.split("\n")[0];
  if (subject.length > 72) {
    throw new Error(
      `commit subject line exceeds 72 characters (${subject.length}): "${subject}"`,
    );
  }
}

// ---------------------------------------------------------------------------
// commitIteration
// ---------------------------------------------------------------------------

/**
 * Stage all changes and commit with the canonical iteration message:
 *   <cardId>/iter-<iterN>: <summary>
 */
export async function commitIteration(
  cardId: string,
  iterN: number,
  summary: string,
  opts: CommitIterationOptions = {},
): Promise<void> {
  const execFn = opts.execFn ?? defaultExec;
  const cwd = opts.cwd;

  const subject = `${cardId}/iter-${iterN}: ${summary}`;
  validateCommitMessage(subject);

  const excludeArgs = WORKSPACE_EXCLUDES.map(f => `':!${f}'`).join(" ");
  const add = await execFn(`git add -A -- ${excludeArgs}`, { cwd });
  if (add.exitCode !== 0) {
    throw new Error(`git add: ${add.stderr.trim()}`);
  }

  const commit = await execFn(`git commit -m ${JSON.stringify(subject)}`, { cwd });
  if (commit.exitCode !== 0) {
    const out = `${commit.stdout}\n${commit.stderr}`.trim();
    if (out.includes("nothing to commit")) return;
    throw new Error(`git commit: ${out}`);
  }
}

// ---------------------------------------------------------------------------
// shipCard steps
// ---------------------------------------------------------------------------

function throwStep(step: string, result: ExecResult): never {
  throw new Error(`${step}: ${result.stderr.trim() || result.stdout.trim()}`);
}

// Files/dirs that must never be committed to main.
// Covers: task tracking files, iteration logs, Next.js build artifacts,
// and the stray apps/ directory that agents sometimes create.
const WORKSPACE_EXCLUDES = [
  "research.md",
  "criteria.md",
  "todo.md",
  "work.md",
  "iter/",
  "apps/",
  ".next/",
  "**/node_modules/",
];

/**
 * Returns true if the staged diff contains any non-markdown, non-workspace
 * file — i.e. this is a code task with real code changes.
 */
async function hasCodeChanges(cwd: string, execFn: ExecFn): Promise<boolean> {
  const result = await execFn("git diff --cached --name-only", { cwd });
  if (result.exitCode !== 0) return false;
  const files = result.stdout.trim().split("\n").filter(Boolean);
  // A "code change" is any file that is NOT a .md file and NOT a workspace tracking file
  return files.some(f => !f.endsWith(".md") && !WORKSPACE_EXCLUDES.some(ex => f === ex || f.startsWith(ex)));
}

async function stepSquash(cardId: string, description: string, cwd: string, execFn: ExecFn): Promise<{ hasCode: boolean }> {
  const subject = `${cardId}: ${description}`;
  validateCommitMessage(subject);

  const mergeBase = await execFn("git merge-base HEAD origin/main", { cwd });
  if (mergeBase.exitCode !== 0) throwStep("squash/merge-base", mergeBase);

  const sha = mergeBase.stdout.trim();

  // Collect iter commit messages before the reset discards them
  const iterLog = await execFn(
    `git log --reverse --format="### %s%n%b" ${sha}..HEAD`,
    { cwd },
  );
  const body = iterLog.exitCode === 0 ? iterLog.stdout.trim() : "";

  const reset = await execFn(`git reset ${sha}`, { cwd });
  if (reset.exitCode !== 0) throwStep("squash/reset", reset);

  // Stage everything EXCEPT workspace tracking files
  const excludeArgs = WORKSPACE_EXCLUDES.map(f => `':!${f}'`).join(" ");
  const add = await execFn(`git add -A -- ${excludeArgs}`, { cwd });
  if (add.exitCode !== 0) throwStep("squash/add", add);

  const codeTask = await hasCodeChanges(cwd, execFn);

  if (!codeTask) {
    // Writing/research task — no code to push to main. Nothing to commit.
    return { hasCode: false };
  }

  const message = body ? `${subject}\n\n${body}` : subject;
  const commit = await execFn(`git commit -m ${JSON.stringify(message)}`, { cwd });
  if (commit.exitCode !== 0) {
    const out = `${commit.stdout}\n${commit.stderr}`.trim();
    if (!out.includes("nothing to commit")) throwStep("squash/commit", commit);
  }

  return { hasCode: true };
}

async function stepFetch(repoRoot: string, execFn: ExecFn): Promise<void> {
  const result = await execFn("git fetch origin", { cwd: repoRoot });
  if (result.exitCode !== 0) throwStep("fetch", result);
}

async function stepRebase(cwd: string, execFn: ExecFn): Promise<void> {
  const result = await execFn("git rebase origin/main", { cwd });
  if (result.exitCode !== 0) throwStep("rebase", result);
}

async function stepCheckoutMain(repoRoot: string, execFn: ExecFn): Promise<void> {
  const result = await execFn("git checkout main", { cwd: repoRoot });
  if (result.exitCode !== 0) throwStep("checkout-main", result);
}

async function stepMerge(cardId: string, repoRoot: string, execFn: ExecFn): Promise<void> {
  const result = await execFn(`git merge --ff-only ${cardId}`, { cwd: repoRoot });
  if (result.exitCode !== 0) throwStep("merge", result);
}

/** Delay helper for exponential backoff */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Classify a push failure from stderr text */
type PushFailureKind = "transient" | "protected" | "config" | "permanent";

function classifyPushFailure(stderr: string): PushFailureKind {
  const s = stderr.toLowerCase();
  // Criterion 11: config errors (no remote origin, not a git repository)
  if (s.includes("no remote origin") || s.includes("does not appear to be a git repository")) {
    return "config";
  }
  // Criterion 9: protected branch
  if (s.includes("protected branch") || s.includes("push to a protected branch")) {
    return "protected";
  }
  // Criterion 8: transient network errors
  if (
    s.includes("could not resolve host") ||
    s.includes("timed out") ||
    s.includes("connection refused") ||
    s.includes("connection reset") ||
    s.includes("network") && s.includes("unreachable")
  ) {
    return "transient";
  }
  return "permanent";
}

async function stepPush(
  repoRoot: string,
  execFn: ExecFn,
  cardId?: string,
  boardUpdateFn?: (id: string, msg: string) => void,
  delayFn: (ms: number) => Promise<void> = delay,
): Promise<void> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1_000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await execFn("git push origin main", { cwd: repoRoot });
    if (result.exitCode === 0) return;

    const stderr = result.stderr.trim() || result.stdout.trim();
    const kind = classifyPushFailure(result.stderr);

    if (kind === "transient" && attempt < MAX_RETRIES) {
      // Criterion 8: retry transient errors with exponential backoff
      const waitMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await delayFn(waitMs);
      continue;
    }

    // Non-retryable or final attempt — log to board then throw
    if (cardId && boardUpdateFn) {
      if (kind === "protected") {
        // Criterion 9: protected branch — suggest opening a PR
        boardUpdateFn(cardId, `Push rejected: branch is protected. Open a pull request instead of pushing directly to main.`);
      } else if (kind === "config") {
        // Criterion 11: config error — log distinctly
        boardUpdateFn(cardId, `Push config error: ${stderr}`);
      } else {
        // Criterion 10: permanent failure — log error before propagating
        boardUpdateFn(cardId, `Push failed: ${stderr}`);
      }
    }

    throwStep("push", result);
  }
}

async function stepWorktreeRemove(cardId: string, repoRoot: string, execFn: ExecFn): Promise<void> {
  const result = await execFn(`git worktree remove worktrees/${cardId}`, { cwd: repoRoot });
  if (result.exitCode !== 0) throwStep("worktree-remove", result);
}

async function stepBranchDelete(cardId: string, repoRoot: string, execFn: ExecFn): Promise<void> {
  const result = await execFn(`git branch -d ${cardId}`, { cwd: repoRoot });
  if (result.exitCode !== 0) throwStep("branch-delete", result);
}

function stepRestartBoard(repoRoot: string, restartBoardFn?: () => void): void {
  if (restartBoardFn) {
    restartBoardFn();
    return;
  }
  const boardDir = resolve(repoRoot, "board");
  if (!existsSync(boardDir)) return; // board app not present, skip restart
  const child = spawn("bun", ["run", "dev"], {
    cwd: boardDir,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

// ---------------------------------------------------------------------------
// shipCard
// ---------------------------------------------------------------------------

/**
 * Squash all iteration commits to one, rebase onto main, merge, push, and
 * clean up the worktree and branch.
 *
 * Each step throws `Error("<step-name>: <stderr>")` on failure.
 */
export async function shipCard(
  cardId: string,
  description: string,
  opts: ShipCardOptions = {},
): Promise<void> {
  const execFn = opts.execFn ?? defaultExec;
  const cwd = opts.cwd ?? process.cwd();
  const repoRoot = opts.repoRoot ?? cwd;

  const { hasCode } = await stepSquash(cardId, description, cwd, execFn);

  if (hasCode) {
    // Code task: rebase onto main, merge, push
    await stepFetch(repoRoot, execFn);
    await stepRebase(cwd, execFn);
    await stepCheckoutMain(repoRoot, execFn);
    await stepMerge(cardId, repoRoot, execFn);
    stepRestartBoard(repoRoot, opts.restartBoardFn);
    await stepPush(repoRoot, execFn, cardId, opts.boardUpdateFn, opts.delayFn);
  } else {
    // Writing/research task: no code to push — just clean up
    await stepCheckoutMain(repoRoot, execFn);
  }

  await stepWorktreeRemove(cardId, repoRoot, execFn);
  await stepBranchDelete(cardId, repoRoot, execFn);
}
