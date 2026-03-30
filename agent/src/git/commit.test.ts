import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateCommitMessage, commitIteration, shipCard } from "./commit.ts";
import type { ExecResult } from "../exec.ts";

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "commit-test-"));
  return realpath(dir);
}

/**
 * Run a git (or other) command using Bun.spawn so it is not affected by
 * mock.module("node:child_process") used in other test files.
 */
async function runCmd(cmd: string, args: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn([cmd, ...args], {
    cwd,
    stdout: "ignore",
    stderr: "pipe",
    stdin: "ignore",
    env: process.env,
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`${cmd} ${args.join(" ")} failed: ${err.trim()}`);
  }
}

async function initGitRepo(dir: string): Promise<void> {
  await runCmd("git", ["init", "-b", "main"], dir);
  await runCmd("git", ["config", "user.email", "test@example.com"], dir);
  await runCmd("git", ["config", "user.name", "Test"], dir);
  await writeFile(join(dir, "init.txt"), "init\n");
  await runCmd("git", ["add", "-A"], dir);
  await runCmd("git", ["commit", "-m", "init"], dir);
}

async function countCommits(dir: string): Promise<number> {
  const proc = Bun.spawn(["git", "rev-list", "--count", "HEAD"], {
    cwd: dir,
    stdout: "pipe",
    stderr: "ignore",
    stdin: "ignore",
    env: process.env,
  });
  const out = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error("git rev-list failed");
  return parseInt(out.trim(), 10);
}

async function lastCommitMessage(dir: string): Promise<string> {
  const proc = Bun.spawn(["git", "log", "-1", "--pretty=%s"], {
    cwd: dir,
    stdout: "pipe",
    stderr: "ignore",
    stdin: "ignore",
    env: process.env,
  });
  const out = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error("git log failed");
  return out.trim();
}

// ---------------------------------------------------------------------------
// validateCommitMessage
// ---------------------------------------------------------------------------

describe("validateCommitMessage", () => {
  it("accepts a normal message", () => {
    expect(() => validateCommitMessage("abc-001: add feature")).not.toThrow();
  });

  it("throws on empty message", () => {
    expect(() => validateCommitMessage("")).toThrow("empty");
  });

  it("throws on whitespace-only message", () => {
    expect(() => validateCommitMessage("   ")).toThrow("empty");
  });

  it("throws when subject exceeds 72 characters", () => {
    expect(() => validateCommitMessage("a".repeat(73))).toThrow("72");
  });

  it("accepts a message of exactly 72 characters", () => {
    expect(() => validateCommitMessage("a".repeat(72))).not.toThrow();
  });

  it("throws with the offending subject in the message", () => {
    const long = "x".repeat(80);
    expect(() => validateCommitMessage(long)).toThrow(long.slice(0, 20));
  });
});

// ---------------------------------------------------------------------------
// commitIteration — integration (real git repo)
// ---------------------------------------------------------------------------

describe("commitIteration (integration)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await initGitRepo(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("stages and commits with correct message format", async () => {
    await writeFile(join(dir, "change.txt"), "change\n");
    const before = await countCommits(dir);
    await commitIteration("abc-001", 1, "scaffold types", { cwd: dir });
    expect(await countCommits(dir)).toBe(before + 1);
    expect(await lastCommitMessage(dir)).toBe("abc-001/iter-1: scaffold types");
  });

  it("throws when summary produces a subject over 72 chars", async () => {
    const longSummary = "x".repeat(80);
    await expect(commitIteration("abc-001", 1, longSummary, { cwd: dir })).rejects.toThrow("72");
  });

  it("does not throw when there is nothing to commit", async () => {
    await expect(
      commitIteration("abc-001", 1, "no changes", { cwd: dir }),
    ).resolves.toBeUndefined();
  });

  it("increments iteration number in commit message", async () => {
    await writeFile(join(dir, "a.txt"), "a\n");
    await commitIteration("task-x", 3, "third iteration", { cwd: dir });
    expect(await lastCommitMessage(dir)).toBe("task-x/iter-3: third iteration");
  });
});

// ---------------------------------------------------------------------------
// shipCard — step sequencing with mock exec
// ---------------------------------------------------------------------------

describe("shipCard step sequencing (mock exec)", () => {
  it("calls steps in order: squash, fetch, rebase, checkout-main, merge, push, worktree-remove, branch-delete", async () => {
    const calls: string[] = [];

    const mockExec = async (cmd: string, _opts?: unknown): Promise<ExecResult> => {
      if (cmd.includes("merge-base")) {
        calls.push("merge-base");
        return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("diff --cached")) {
        return { stdout: "src/index.ts\n", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("git reset")) {
        calls.push("reset");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("git add")) {
        calls.push("add");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("git commit")) {
        calls.push("commit");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("git fetch")) {
        calls.push("fetch");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("git rebase")) {
        calls.push("rebase");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("git checkout")) {
        calls.push("checkout-main");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("git merge")) {
        calls.push("merge");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("git push")) {
        calls.push("push");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("worktree remove")) {
        calls.push("worktree-remove");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("branch -d")) {
        calls.push("branch-delete");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    await shipCard("my-task", "add feature", { execFn: mockExec, restartBoardFn: () => {} });

    expect(calls).toContain("merge-base");
    expect(calls).toContain("reset");
    expect(calls).toContain("fetch");
    expect(calls).toContain("rebase");
    expect(calls).toContain("checkout-main");
    expect(calls).toContain("merge");
    expect(calls).toContain("push");
    expect(calls).toContain("worktree-remove");
    expect(calls).toContain("branch-delete");

    // fetch must happen before rebase
    expect(calls.indexOf("fetch")).toBeLessThan(calls.indexOf("rebase"));
    // rebase before checkout
    expect(calls.indexOf("rebase")).toBeLessThan(calls.indexOf("checkout-main"));
    // checkout before merge
    expect(calls.indexOf("checkout-main")).toBeLessThan(calls.indexOf("merge"));
    // merge before push
    expect(calls.indexOf("merge")).toBeLessThan(calls.indexOf("push"));
    // push before cleanup
    expect(calls.indexOf("push")).toBeLessThan(calls.indexOf("worktree-remove"));
  });

  it("throws with step name when fetch fails", async () => {
    const mockExec = async (cmd: string): Promise<ExecResult> => {
      if (cmd.includes("merge-base")) return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      if (cmd.includes("diff --cached")) return { stdout: "src/index.ts\n", stderr: "", exitCode: 0 };
      if (cmd.includes("git reset")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git add")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git commit")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git fetch")) return { stdout: "", stderr: "network error", exitCode: 1 };
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    await expect(shipCard("my-task", "description", { execFn: mockExec })).rejects.toThrow("fetch");
  });

  it("throws with step name when merge fails", async () => {
    const mockExec = async (cmd: string): Promise<ExecResult> => {
      if (cmd.includes("merge-base")) return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      if (cmd.includes("diff --cached")) return { stdout: "src/index.ts\n", stderr: "", exitCode: 0 };
      if (cmd.includes("git reset")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git add")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git commit")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git fetch")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git rebase")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git checkout")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git merge")) return { stdout: "", stderr: "conflict", exitCode: 1 };
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    await expect(shipCard("my-task", "description", { execFn: mockExec })).rejects.toThrow("merge");
  });

  it("throws when description produces subject over 72 chars", async () => {
    const mockExec = async (): Promise<ExecResult> => ({ stdout: "", stderr: "", exitCode: 0 });
    await expect(
      shipCard("my-task", "x".repeat(80), { execFn: mockExec }),
    ).rejects.toThrow("72");
  });

  it("throws with step name when push fails", async () => {
    const mockExec = async (cmd: string): Promise<ExecResult> => {
      if (cmd.includes("merge-base")) return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      if (cmd.includes("diff --cached")) return { stdout: "src/index.ts\n", stderr: "", exitCode: 0 };
      if (cmd.includes("git reset")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git add")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git commit")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git fetch")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git rebase")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git checkout")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git merge")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git push")) return { stdout: "", stderr: "rejected", exitCode: 1 };
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    await expect(shipCard("my-task", "description", { execFn: mockExec, restartBoardFn: () => {} })).rejects.toThrow("push");
  });
});

// ---------------------------------------------------------------------------
// stepPush — error categorization (criterion 8, 9, 10, 11)
// ---------------------------------------------------------------------------

function successExceptPush(pushStderr: string): (cmd: string) => Promise<ExecResult> {
  let pushCallCount = 0;
  return async (cmd: string): Promise<ExecResult> => {
    if (cmd.includes("merge-base")) return { stdout: "abc123\n", stderr: "", exitCode: 0 };
    if (cmd.includes("diff --cached")) return { stdout: "src/index.ts\n", stderr: "", exitCode: 0 };
    if (cmd.includes("git reset")) return { stdout: "", stderr: "", exitCode: 0 };
    if (cmd.includes("git add")) return { stdout: "", stderr: "", exitCode: 0 };
    if (cmd.includes("git commit")) return { stdout: "", stderr: "", exitCode: 0 };
    if (cmd.includes("git fetch")) return { stdout: "", stderr: "", exitCode: 0 };
    if (cmd.includes("git rebase")) return { stdout: "", stderr: "", exitCode: 0 };
    if (cmd.includes("git checkout")) return { stdout: "", stderr: "", exitCode: 0 };
    if (cmd.includes("git merge")) return { stdout: "", stderr: "", exitCode: 0 };
    if (cmd.includes("git push")) {
      pushCallCount++;
      return { stdout: "", stderr: pushStderr, exitCode: 1 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

describe("stepPush — permanent failure updates board (criterion 10)", () => {
  it("calls boardUpdateFn with push error before throwing", async () => {
    const boardMessages: string[] = [];
    const mockExec = successExceptPush("some permanent git error");

    await expect(
      shipCard("my-task", "description", {
        execFn: mockExec,
        boardUpdateFn: (_id, msg) => boardMessages.push(msg),
        restartBoardFn: () => {},
      }),
    ).rejects.toThrow("push");

    expect(boardMessages.length).toBeGreaterThan(0);
    expect(boardMessages[0]).toContain("some permanent git error");
  });

  it("includes cardId in boardUpdateFn call", async () => {
    const boardIds: string[] = [];
    const mockExec = successExceptPush("fatal error");

    await expect(
      shipCard("my-task", "description", {
        execFn: mockExec,
        boardUpdateFn: (id, _msg) => boardIds.push(id),
        restartBoardFn: () => {},
      }),
    ).rejects.toThrow("push");

    expect(boardIds).toContain("my-task");
  });
});

describe("stepPush — protected branch (criterion 9)", () => {
  it("calls boardUpdateFn with PR suggestion when branch is protected", async () => {
    const boardMessages: string[] = [];
    const mockExec = successExceptPush("error: push to a protected branch is not allowed");

    await expect(
      shipCard("my-task", "description", {
        execFn: mockExec,
        boardUpdateFn: (_id, msg) => boardMessages.push(msg),
        restartBoardFn: () => {},
      }),
    ).rejects.toThrow("push");

    expect(boardMessages.length).toBeGreaterThan(0);
    expect(boardMessages[0].toLowerCase()).toMatch(/pull request|pr/);
  });

  it("also handles 'protected branch' stderr variant", async () => {
    const boardMessages: string[] = [];
    const mockExec = successExceptPush("! [remote rejected] protected branch policy violation");

    await expect(
      shipCard("my-task", "description", {
        execFn: mockExec,
        boardUpdateFn: (_id, msg) => boardMessages.push(msg),
        restartBoardFn: () => {},
      }),
    ).rejects.toThrow("push");

    expect(boardMessages.length).toBeGreaterThan(0);
    expect(boardMessages[0].toLowerCase()).toMatch(/pull request|pr/);
  });
});

describe("stepPush — config error (criterion 11)", () => {
  it("categorizes 'no remote origin' as config error with distinct message", async () => {
    const boardMessages: string[] = [];
    const mockExec = successExceptPush("fatal: 'origin' does not appear to be a git repository");

    await expect(
      shipCard("my-task", "description", {
        execFn: mockExec,
        boardUpdateFn: (_id, msg) => boardMessages.push(msg),
        restartBoardFn: () => {},
      }),
    ).rejects.toThrow("push");

    expect(boardMessages.length).toBeGreaterThan(0);
    expect(boardMessages[0].toLowerCase()).toContain("config error");
  });
});

describe("stepPush — transient retry (criterion 8)", () => {
  it("retries up to 3x on transient network error before failing", async () => {
    let pushCallCount = 0;
    const boardMessages: string[] = [];

    const mockExec = async (cmd: string): Promise<ExecResult> => {
      if (cmd.includes("merge-base")) return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      if (cmd.includes("git reset")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("diff --cached")) return { stdout: "src/index.ts\n", stderr: "", exitCode: 0 };
      if (cmd.includes("git add")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git commit")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git fetch")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git rebase")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git checkout")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git merge")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git push")) {
        pushCallCount++;
        return { stdout: "", stderr: "Could not resolve host: github.com", exitCode: 1 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    await expect(
      shipCard("my-task", "description", {
        execFn: mockExec,
        boardUpdateFn: (_id, msg) => boardMessages.push(msg),
        restartBoardFn: () => {},
      }),
    ).rejects.toThrow("push");

    // Should have been retried 3 times total
    expect(pushCallCount).toBe(3);
  });

  it("succeeds on second attempt after transient failure", async () => {
    let pushCallCount = 0;

    const mockExec = async (cmd: string): Promise<ExecResult> => {
      if (cmd.includes("merge-base")) return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      if (cmd.includes("git reset")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("diff --cached")) return { stdout: "src/index.ts\n", stderr: "", exitCode: 0 };
      if (cmd.includes("git add")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git commit")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git fetch")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git rebase")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git checkout")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git merge")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git push")) {
        pushCallCount++;
        if (pushCallCount === 1) {
          return { stdout: "", stderr: "timed out connecting to github.com", exitCode: 1 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("worktree remove")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("branch -d")) return { stdout: "", stderr: "", exitCode: 0 };
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    await expect(
      shipCard("my-task", "description", { execFn: mockExec, restartBoardFn: () => {} }),
    ).resolves.toBeUndefined();

    expect(pushCallCount).toBe(2);
  });

  it("does NOT retry on permanent (non-transient) push failure", async () => {
    let pushCallCount = 0;
    const boardMessages: string[] = [];

    const mockExec = async (cmd: string): Promise<ExecResult> => {
      if (cmd.includes("merge-base")) return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      if (cmd.includes("git reset")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("diff --cached")) return { stdout: "src/index.ts\n", stderr: "", exitCode: 0 };
      if (cmd.includes("git add")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git commit")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git fetch")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git rebase")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git checkout")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git merge")) return { stdout: "", stderr: "", exitCode: 0 };
      if (cmd.includes("git push")) {
        pushCallCount++;
        return { stdout: "", stderr: "! [rejected] main -> main (non-fast-forward)", exitCode: 1 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    await expect(
      shipCard("my-task", "description", {
        execFn: mockExec,
        boardUpdateFn: (_id, msg) => boardMessages.push(msg),
        restartBoardFn: () => {},
      }),
    ).rejects.toThrow("push");

    // Should only be called once (no retries for permanent errors)
    expect(pushCallCount).toBe(1);
  });
});
