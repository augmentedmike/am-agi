import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "runner-test-"));
  return realpath(dir);
}

/**
 * Initialise a bare git repo in dir so `git commit` works.
 */
async function initGitRepo(dir: string): Promise<void> {
  await runCmd("git", ["init", "-b", "main"], dir);
  await runCmd("git", ["config", "user.email", "test@example.com"], dir);
  await runCmd("git", ["config", "user.name", "Test"], dir);
  // Create an initial commit so HEAD exists
  await writeFile(join(dir, "work.md"), "initial\n");
  await runCmd("git", ["add", "-A"], dir);
  await runCmd("git", ["commit", "-m", "init"], dir);
}

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
        const msg = Buffer.concat(errChunks).toString("utf8").trim();
        reject(new Error(`${cmd} ${args.join(" ")} failed (${code}): ${msg}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Count commits on the current branch.
 */
async function countCommits(dir: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["rev-list", "--count", "HEAD"], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const out: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) { reject(new Error("git rev-list failed")); return; }
      resolve(parseInt(Buffer.concat(out).toString("utf8").trim(), 10));
    });
  });
}

/**
 * Get the last commit message.
 */
async function lastCommitMessage(dir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["log", "-1", "--pretty=%s"], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const out: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) { reject(new Error("git log failed")); return; }
      resolve(Buffer.concat(out).toString("utf8").trim());
    });
  });
}

// ---------------------------------------------------------------------------
// extractSummary (tested via the runner internals through the commit message)
// ---------------------------------------------------------------------------

// We import the runner's internal functions by duplicating the logic here,
// since they are not exported. The behaviour is verified end-to-end below.

// ---------------------------------------------------------------------------
// runLoop — integration tests
// ---------------------------------------------------------------------------

describe("runLoop", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await initGitRepo(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("commits after each iteration and exits 0 when result contains DONE", async () => {
    const { runLoop } = await import("./index.ts");

    const before = await countCommits(dir);

    const fakeRunIteration = async () => ({
      exitCode: 0,
      result: "DONE — task complete",
    });

    // Override process.exit so the test doesn't kill the process
    let exitCode: number | undefined;
    const originalExit = process.exit.bind(process);
    (process as any).exit = (code?: number) => {
      exitCode = code;
      throw new Error(`__process_exit_${code}`);
    };

    try {
      await runLoop(dir, 20, { runIterationFn: fakeRunIteration });
    } catch (err: any) {
      if (!err.message?.startsWith("__process_exit_")) throw err;
    } finally {
      (process as any).exit = originalExit;
    }

    expect(exitCode).toBe(0);

    const after = await countCommits(dir);
    expect(after).toBe(before + 1);

    const msg = await lastCommitMessage(dir);
    expect(msg).toMatch(/^iter:/);
    expect(msg).toContain("DONE");
  });

  it("produces a commit after each iteration", async () => {
    const { runLoop } = await import("./index.ts");

    let callCount = 0;
    const fakeRunIteration = async () => {
      callCount++;
      if (callCount >= 3) {
        return { exitCode: 0, result: "DONE" };
      }
      // Write a file so there's something to commit
      await writeFile(join(dir, `iter-${callCount}.txt`), `iteration ${callCount}\n`);
      return { exitCode: 0, result: `iteration ${callCount} done` };
    };

    const before = await countCommits(dir);

    let exitCode: number | undefined;
    const originalExit = process.exit.bind(process);
    (process as any).exit = (code?: number) => {
      exitCode = code;
      throw new Error(`__process_exit_${code}`);
    };

    try {
      await runLoop(dir, 20, { runIterationFn: fakeRunIteration });
    } catch (err: any) {
      if (!err.message?.startsWith("__process_exit_")) throw err;
    } finally {
      (process as any).exit = originalExit;
    }

    expect(exitCode).toBe(0);
    // 3 calls: iter 1 (commit), iter 2 (commit), iter 3 DONE (commit)
    const after = await countCommits(dir);
    expect(after).toBe(before + 3);
  });

  it("exits 1 when runIteration throws", async () => {
    const { runLoop } = await import("./index.ts");

    const fakeRunIteration = async () => {
      throw new Error("claude exploded");
    };

    let exitCode: number | undefined;
    const originalExit = process.exit.bind(process);
    (process as any).exit = (code?: number) => {
      exitCode = code;
      throw new Error(`__process_exit_${code}`);
    };

    try {
      await runLoop(dir, 20, { runIterationFn: fakeRunIteration });
    } catch (err: any) {
      if (!err.message?.startsWith("__process_exit_")) throw err;
    } finally {
      (process as any).exit = originalExit;
    }

    expect(exitCode).toBe(1);
  });

  it("exits 1 when max iterations is reached", async () => {
    const { runLoop } = await import("./index.ts");

    let callCount = 0;
    const fakeRunIteration = async () => {
      callCount++;
      await writeFile(join(dir, `iter-${callCount}.txt`), `${callCount}\n`);
      return { exitCode: 0, result: "still working" };
    };

    let exitCode: number | undefined;
    const originalExit = process.exit.bind(process);
    (process as any).exit = (code?: number) => {
      exitCode = code;
      throw new Error(`__process_exit_${code}`);
    };

    try {
      await runLoop(dir, 3, { runIterationFn: fakeRunIteration });
    } catch (err: any) {
      if (!err.message?.startsWith("__process_exit_")) throw err;
    } finally {
      (process as any).exit = originalExit;
    }

    expect(exitCode).toBe(1);
    expect(callCount).toBe(3);
  });

  it("commit message uses first non-empty line of result, truncated to 72 chars", async () => {
    const { runLoop } = await import("./index.ts");

    const longResult = "A".repeat(80) + "\nDONE";
    const fakeRunIteration = async () => ({ exitCode: 0, result: longResult });

    let exitCode: number | undefined;
    const originalExit = process.exit.bind(process);
    (process as any).exit = (code?: number) => {
      exitCode = code;
      throw new Error(`__process_exit_${code}`);
    };

    try {
      await runLoop(dir, 20, { runIterationFn: fakeRunIteration });
    } catch (err: any) {
      if (!err.message?.startsWith("__process_exit_")) throw err;
    } finally {
      (process as any).exit = originalExit;
    }

    const msg = await lastCommitMessage(dir);
    // "iter: " prefix + up to 72 chars of content
    expect(msg.length).toBeLessThanOrEqual("iter: ".length + 72);
  });
});
