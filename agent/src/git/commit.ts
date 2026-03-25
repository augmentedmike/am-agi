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

  const add = await execFn("git add -A", { cwd });
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

async function stepSquash(cardId: string, description: string, cwd: string, execFn: ExecFn): Promise<void> {
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

  const add = await execFn("git add -A", { cwd });
  if (add.exitCode !== 0) throwStep("squash/add", add);

  const message = body ? `${subject}\n\n${body}` : subject;
  const commit = await execFn(`git commit -m ${JSON.stringify(message)}`, { cwd });
  if (commit.exitCode !== 0) throwStep("squash/commit", commit);
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

async function stepPush(repoRoot: string, execFn: ExecFn): Promise<void> {
  const result = await execFn("git push origin main", { cwd: repoRoot });
  if (result.exitCode !== 0) throwStep("push", result);
}

async function stepWorktreeRemove(cardId: string, repoRoot: string, execFn: ExecFn): Promise<void> {
  const result = await execFn(`git worktree remove ../am-${cardId}`, { cwd: repoRoot });
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
  const boardDir = resolve(repoRoot, "apps/board");
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

  await stepSquash(cardId, description, cwd, execFn);
  await stepFetch(repoRoot, execFn);
  await stepRebase(cwd, execFn);
  await stepCheckoutMain(repoRoot, execFn);
  await stepMerge(cardId, repoRoot, execFn);
  stepRestartBoard(repoRoot, opts.restartBoardFn);
  await stepPush(repoRoot, execFn);
  await stepWorktreeRemove(cardId, repoRoot, execFn);
  await stepBranchDelete(cardId, repoRoot, execFn);
}
