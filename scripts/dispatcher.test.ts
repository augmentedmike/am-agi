import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { AuthError } from "../agent/src/loop/invoke-claude.ts";
import { runCard } from "../bin/dispatcher";
import type { RunCardDeps } from "../bin/dispatcher";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "dispatcher-test-"));
  return realpath(dir);
}

async function initGitRepo(dir: string): Promise<void> {
  const run = (args: string[]) =>
    new Promise<void>((resolve, reject) => {
      const child = spawnSync("git", args, { cwd: dir, stdio: "pipe", env: process.env });
      if (child.status !== 0) reject(new Error(`git ${args[0]} failed`));
      else resolve();
    });
  // spawnSync returns synchronously — just call directly
  spawnSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "pipe", env: process.env });
  spawnSync("git", ["config", "user.email", "test@test.com"], { cwd: dir, stdio: "pipe", env: process.env });
  spawnSync("git", ["config", "user.name", "Test"], { cwd: dir, stdio: "pipe", env: process.env });
  await writeFile(join(dir, "work.md"), "# test\n");
  spawnSync("git", ["add", "-A"], { cwd: dir, stdio: "pipe", env: process.env });
  spawnSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "pipe", env: process.env });
}

/**
 * Build a minimal fake Card object.
 * workDir is set to repoRoot so ensureWorktree finds an existing directory and
 * the PATCH-to-register-workDir fetch is skipped (card.workDir is truthy).
 */
function fakeCard(
  repoRoot: string,
  overrides: Partial<{ id: string; title: string; state: string; priority: string }> = {},
) {
  return {
    id: overrides.id ?? "test-card-id",
    title: overrides.title ?? "Test card",
    state: (overrides.state ?? "in-progress") as any,
    priority: (overrides.priority ?? "normal") as any,
    workDir: repoRoot,
  };
}

// ---------------------------------------------------------------------------
// runCard — AuthError handling
// ---------------------------------------------------------------------------

describe("runCard — AuthError handling", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await makeTempDir();
    await initGitRepo(repoRoot);
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it("calls boardUpdateFn with auth message when runIterationFn throws AuthError", async () => {
    const boardUpdates: Array<{ id: string; msg: string }> = [];

    const deps: RunCardDeps = {
      runIterationFn: async () => {
        throw new AuthError("Claude auth expired — run /login to restore");
      },
      boardUpdateFn: (id, msg) => boardUpdates.push({ id, msg }),
    };

    const card = fakeCard(repoRoot);

    // We expect runCard to handle the AuthError without throwing
    await runCard(card, deps);

    expect(boardUpdates.length).toBe(1);
    expect(boardUpdates[0].id).toBe(card.id);
    expect(boardUpdates[0].msg).toContain("/login");
  });

  it("does NOT call boardUpdateFn for non-auth errors", async () => {
    const boardUpdates: Array<{ id: string; msg: string }> = [];

    const deps: RunCardDeps = {
      runIterationFn: async () => {
        throw new Error("some random failure");
      },
      boardUpdateFn: (id, msg) => boardUpdates.push({ id, msg }),
    };

    const card = fakeCard(repoRoot);
    await runCard(card, deps);

    expect(boardUpdates.length).toBe(0);
  });

  it("resolves without throwing when AuthError occurs", async () => {
    const deps: RunCardDeps = {
      runIterationFn: async () => {
        throw new AuthError();
      },
      boardUpdateFn: () => {},
    };

    await expect(runCard(fakeCard(repoRoot), deps)).resolves.toBeUndefined();
  });

  it("resolves without throwing when a non-auth error occurs", async () => {
    const deps: RunCardDeps = {
      runIterationFn: async () => {
        throw new Error("explosion");
      },
      boardUpdateFn: () => {},
    };

    await expect(runCard(fakeCard(repoRoot), deps)).resolves.toBeUndefined();
  });

  it("calls boardUpdateFn exactly once per AuthError (no retry)", async () => {
    let iterationCalls = 0;
    const boardUpdates: string[] = [];

    const deps: RunCardDeps = {
      runIterationFn: async () => {
        iterationCalls++;
        throw new AuthError();
      },
      boardUpdateFn: (_id, msg) => boardUpdates.push(msg),
    };

    await runCard(fakeCard(repoRoot), deps);

    expect(iterationCalls).toBe(1);
    expect(boardUpdates.length).toBe(1);
  });

  it("continues polling (resolves) after auth error — does not crash (criterion 3)", async () => {
    // runCard must resolve (not throw) so the dispatch loop can continue
    const deps: RunCardDeps = {
      runIterationFn: async () => { throw new AuthError(); },
      boardUpdateFn: () => {},
    };

    // Two sequential runCard calls must both resolve — simulating polling continues
    await expect(runCard(fakeCard(repoRoot, { id: "card-1" }), deps)).resolves.toBeUndefined();
    await expect(runCard(fakeCard(repoRoot, { id: "card-2" }), deps)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// runCard — ensureWorktree failures (criteria 5, 6, 7)
// ---------------------------------------------------------------------------

describe("runCard — ensureWorktree failure handling", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await makeTempDir();
    await initGitRepo(repoRoot);
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it("logs worktree failure to board and resolves (criterion 5)", async () => {
    const boardUpdates: Array<{ id: string; msg: string }> = [];
    let iterationCalled = false;

    const card = fakeCard(repoRoot, { id: "test-worktree-fail" });
    // Remove workDir so ensureWorktreeFn is invoked
    const { workDir: _, ...cardWithoutWorkDir } = card;

    const deps: RunCardDeps = {
      ensureWorktreeFn: (_cardId: string) => {
        throw new Error("git worktree add failed: no remote origin configured");
      },
      runIterationFn: async () => { iterationCalled = true; },
      boardUpdateFn: (id, msg) => boardUpdates.push({ id, msg }),
    };

    await expect(runCard(cardWithoutWorkDir as any, deps)).resolves.toBeUndefined();

    expect(iterationCalled).toBe(false);
    expect(boardUpdates.length).toBeGreaterThan(0);
    expect(boardUpdates[0].msg.toLowerCase()).toContain("worktree");
  });

  it("includes failure reason in board message (criterion 5)", async () => {
    const boardUpdates: Array<{ id: string; msg: string }> = [];

    const card = fakeCard(repoRoot, { id: "test-reason-capture" });
    const { workDir: _, ...cardWithoutWorkDir } = card;

    const deps: RunCardDeps = {
      ensureWorktreeFn: (_cardId: string) => {
        throw new Error("no remote origin configured (card test-reason-capture)");
      },
      runIterationFn: async () => {},
      boardUpdateFn: (id, msg) => boardUpdates.push({ id, msg }),
    };

    await runCard(cardWithoutWorkDir as any, deps);

    expect(boardUpdates.length).toBeGreaterThan(0);
    expect(boardUpdates[0].msg).toContain("no remote origin configured");
    expect(boardUpdates[0].id).toBe("test-reason-capture");
  });

  it("logs 'git not found in PATH' when git is missing (criterion 6)", async () => {
    const boardUpdates: Array<{ id: string; msg: string }> = [];

    const card = fakeCard(repoRoot, { id: "test-no-git" });
    const { workDir: _, ...cardWithoutWorkDir } = card;

    const deps: RunCardDeps = {
      ensureWorktreeFn: (_cardId: string) => {
        throw new Error("git not found in PATH");
      },
      runIterationFn: async () => {},
      boardUpdateFn: (id, msg) => boardUpdates.push({ id, msg }),
    };

    await runCard(cardWithoutWorkDir as any, deps);

    expect(boardUpdates.length).toBeGreaterThan(0);
    expect(boardUpdates[0].msg.toLowerCase()).toContain("git not found");
  });

  it("logs 'repo not found at <path>' when repo path is missing (criterion 7)", async () => {
    const boardUpdates: Array<{ id: string; msg: string }> = [];

    const card = fakeCard(repoRoot, { id: "test-no-repo" });
    const { workDir: _, ...cardWithoutWorkDir } = card;

    const deps: RunCardDeps = {
      ensureWorktreeFn: (_cardId: string) => {
        throw new Error("repo not found at /nonexistent/path");
      },
      runIterationFn: async () => {},
      boardUpdateFn: (id, msg) => boardUpdates.push({ id, msg }),
    };

    await runCard(cardWithoutWorkDir as any, deps);

    expect(boardUpdates.length).toBeGreaterThan(0);
    expect(boardUpdates[0].msg).toContain("repo not found at");
  });
});
