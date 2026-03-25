import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { AuthError } from "../agent/src/loop/invoke-claude.ts";
import { runCard } from "./dispatcher.ts";
import type { RunCardDeps } from "./dispatcher.ts";

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
});
