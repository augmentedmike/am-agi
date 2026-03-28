/**
 * E2E smoke test for auto-ship — exercises shipCard() against a real git
 * repository with a local bare "remote" so git fetch / push work without
 * network access.
 *
 * Directory layout created per test:
 *
 *   <tmpRoot>/
 *     remote/        bare repo — acts as origin
 *     main/          local repo (repoRoot), origin → remote
 *     main/worktrees/<cardId>/   worktree created by the test, removed by shipCard
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, realpath, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { shipCard } from "./commit.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "am-e2e-ship-"));
  return realpath(dir);
}

/**
 * Run a git (or other) command synchronously, throwing on non-zero exit.
 */
function runCmd(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const errChunks: Buffer[] = [];
    child.stderr.on("data", (c: Buffer) => errChunks.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${cmd} ${args.join(" ")} failed (${code}): ${Buffer.concat(errChunks).toString("utf8").trim()}`,
          ),
        );
        return;
      }
      resolve();
    });
  });
}

/**
 * Capture stdout from a git command.
 */
function captureCmd(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => outChunks.push(c));
    child.stderr.on("data", (c: Buffer) => errChunks.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${cmd} ${args.join(" ")} failed (${code}): ${Buffer.concat(errChunks).toString("utf8").trim()}`,
          ),
        );
        return;
      }
      resolve(Buffer.concat(outChunks).toString("utf8").trim());
    });
  });
}

async function countCommits(repoDir: string): Promise<number> {
  const out = await captureCmd("git", ["rev-list", "--count", "HEAD"], repoDir);
  return parseInt(out, 10);
}

async function lastCommitMessage(repoDir: string): Promise<string> {
  return captureCmd("git", ["log", "-1", "--pretty=%s"], repoDir);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function branchExists(repoDir: string, branchName: string): Promise<boolean> {
  try {
    await captureCmd("git", ["rev-parse", "--verify", branchName], repoDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Set up a bare "remote" repo and a local repo pointing to it,
 * with an initial commit already pushed to origin.
 *
 * Returns { remoteDir, repoRoot }.
 */
async function setupRepos(tmpRoot: string): Promise<{ remoteDir: string; repoRoot: string }> {
  const remoteDir = join(tmpRoot, "remote");
  const repoRoot = join(tmpRoot, "main");

  await mkdir(remoteDir);
  await mkdir(repoRoot);

  // 1. Init bare remote
  await runCmd("git", ["init", "--bare", "-b", "main"], remoteDir);

  // 2. Init local repo
  await runCmd("git", ["init", "-b", "main"], repoRoot);
  await runCmd("git", ["config", "user.email", "test@example.com"], repoRoot);
  await runCmd("git", ["config", "user.name", "Test"], repoRoot);

  // 3. Initial commit
  await writeFile(join(repoRoot, "README.md"), "# AM test repo\n");
  await runCmd("git", ["add", "-A"], repoRoot);
  await runCmd("git", ["commit", "-m", "init"], repoRoot);

  // 4. Wire up origin and push
  await runCmd("git", ["remote", "add", "origin", remoteDir], repoRoot);
  await runCmd("git", ["push", "-u", "origin", "main"], repoRoot);

  return { remoteDir, repoRoot };
}

/**
 * Create a worktree at <tmpRoot>/am-<cardId> branched from main,
 * add `iterCount` iteration commits to it, and return its path.
 */
async function setupWorktree(
  tmpRoot: string,
  repoRoot: string,
  cardId: string,
  iterCount = 2,
): Promise<string> {
  // worktreeDir at <repoRoot>/worktrees/<cardId> — matches production AM layout
  const worktreeDir = join(repoRoot, "worktrees", cardId);

  await runCmd("git", ["worktree", "add", worktreeDir, "-b", cardId], repoRoot);
  await runCmd("git", ["config", "user.email", "test@example.com"], worktreeDir);
  await runCmd("git", ["config", "user.name", "Test"], worktreeDir);

  // Add iteration commits
  for (let i = 1; i <= iterCount; i++) {
    await writeFile(join(worktreeDir, `iter-${i}.txt`), `iteration ${i}\n`);
    await runCmd("git", ["add", "-A"], worktreeDir);
    await runCmd("git", ["commit", "-m", `${cardId}/iter-${i}: work for iter ${i}`], worktreeDir);
  }

  return worktreeDir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("shipCard — E2E smoke test", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await makeTempRoot();
  });

  afterEach(async () => {
    // Best-effort cleanup — shipCard removes the worktree; we remove the rest
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("squashes iteration commits, merges to main, removes worktree and branch", async () => {
    const cardId = "smoke-test-card";
    const description = "add E2E smoke test";

    const { repoRoot } = await setupRepos(tmpRoot);
    const worktreeDir = await setupWorktree(tmpRoot, repoRoot, cardId, 2);

    const initialCommits = await countCommits(repoRoot);

    // Run shipCard with real git — suppress board restart side-effect
    await shipCard(cardId, description, {
      cwd: worktreeDir,
      repoRoot,
      restartBoardFn: () => {},
    });

    // ── Criterion 4: resolves without throwing ──────────────────────────────
    // (reaching here means no throw occurred)

    // ── Criterion 5: main has exactly one new commit ────────────────────────
    const finalCommits = await countCommits(repoRoot);
    expect(finalCommits).toBe(initialCommits + 1);

    // ── Criterion 6: squashed commit message starts with "<cardId>: " ───────
    const msg = await lastCommitMessage(repoRoot);
    expect(msg).toMatch(new RegExp(`^${cardId}: `));
    expect(msg).toContain(description);

    // ── Criterion 7: worktree directory no longer exists ────────────────────
    const worktreeGone = !(await pathExists(worktreeDir));
    expect(worktreeGone).toBe(true);

    // ── Criterion 8: branch no longer exists ────────────────────────────────
    const branchGone = !(await branchExists(repoRoot, cardId));
    expect(branchGone).toBe(true);
  });

  it("squashed commit body includes individual iteration summaries", async () => {
    const cardId = "smoke-test-body";
    const description = "verify commit body";

    const { repoRoot } = await setupRepos(tmpRoot);
    const worktreeDir = await setupWorktree(tmpRoot, repoRoot, cardId, 3);

    await shipCard(cardId, description, {
      cwd: worktreeDir,
      repoRoot,
      restartBoardFn: () => {},
    });

    // The full commit message (body) should include at least one iter subject
    const fullMsg = await captureCmd("git", ["log", "-1", "--pretty=%B"], repoRoot);
    // stepSquash collects iter messages via git log --reverse --format="### %s%n%b"
    expect(fullMsg).toContain(`${cardId}/iter-1:`);
  });

  it("calls restartBoardFn instead of spawning real board restart", async () => {
    const cardId = "smoke-test-restart";
    const description = "test restart hook";

    const { repoRoot } = await setupRepos(tmpRoot);
    const worktreeDir = await setupWorktree(tmpRoot, repoRoot, cardId, 1);

    let restartCalled = false;

    await shipCard(cardId, description, {
      cwd: worktreeDir,
      repoRoot,
      restartBoardFn: () => {
        restartCalled = true;
      },
    });

    // ── Criterion 10: restartBoardFn is called ───────────────────────────────
    expect(restartCalled).toBe(true);
  });
});
