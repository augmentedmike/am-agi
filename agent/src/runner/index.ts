import { runIteration } from "../loop/index.ts";
import type { InvokeOptions } from "../loop/invoke-claude.ts";
import { AuthError } from "../loop/invoke-claude.ts";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// extractSummary
// ---------------------------------------------------------------------------

/**
 * Extract a one-line summary from the result string.
 * Returns the first non-empty line, truncated to 72 characters.
 */
function extractSummary(result: string): string {
  // result is raw JSON stdout from Claude — parse out the `result` field first
  let text = result;
  try {
    const parsed = JSON.parse(result) as { result?: string };
    if (parsed.result) text = parsed.result;
  } catch {
    // not JSON — use raw
  }
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0) ?? "iteration complete";
  return line.slice(0, 72);
}

// ---------------------------------------------------------------------------
// isDone
// ---------------------------------------------------------------------------

function isDone(result: string): boolean {
  return result.includes("DONE");
}

// ---------------------------------------------------------------------------
// commitIteration
// ---------------------------------------------------------------------------

function commitIteration(workDir: string, summary: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const add = spawn("git", ["add", "-A"], {
      cwd: workDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    add.on("error", (err) => reject(new Error(`git add failed to spawn — ${err.message}`)));

    add.on("close", (addCode) => {
      if (addCode !== 0) {
        reject(new Error(`git add failed with exit code ${addCode}`));
        return;
      }

      const commit = spawn("git", ["commit", "--allow-empty", "-m", `iter: ${summary}`], {
        cwd: workDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

      const outChunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      commit.stdout.on("data", (c: Buffer) => outChunks.push(c));
      commit.stderr.on("data", (c: Buffer) => errChunks.push(c));

      commit.on("error", (err) => reject(new Error(`git commit failed to spawn — ${err.message}`)));

      commit.on("close", (commitCode) => {
        if (commitCode !== 0) {
          // A non-zero exit on commit may mean "nothing to commit" — treat as OK
          const stdout = Buffer.concat(outChunks).toString("utf8").trim();
          const stderr = Buffer.concat(errChunks).toString("utf8").trim();
          const combined = `${stdout}\n${stderr}`.trim();
          if (combined.includes("nothing to commit")) {
            resolve();
            return;
          }
          reject(new Error(`git commit failed: ${combined}`));
          return;
        }
        resolve();
      });
    });
  });
}

// ---------------------------------------------------------------------------
// runLoop
// ---------------------------------------------------------------------------

export interface RunLoopOptions extends InvokeOptions {
  /** Injected runIteration — used for testing. Defaults to the real implementation. */
  runIterationFn?: (workDir: string, options?: InvokeOptions) => Promise<{ result: string; exitCode: number }>;
}

/**
 * Run the agent loop until Claude outputs "DONE" or maxIterations is reached.
 *
 * @param workDir       Absolute path to the git worktree for this task.
 * @param maxIterations Maximum number of iterations before giving up. Defaults to 20.
 * @param options       Optional overrides (e.g. claudePath, runIterationFn for testing).
 */
export async function runLoop(
  workDir: string,
  maxIterations = 20,
  options: RunLoopOptions = {},
): Promise<void> {
  const { runIterationFn, ...invokeOptions } = options;
  const doIteration = runIterationFn ?? runIteration;

  for (let i = 0; i < maxIterations; i++) {
    let result: string;

    try {
      const output = await doIteration(workDir, invokeOptions);
      result = output.result;
    } catch (err) {
      // Re-throw auth errors so callers can handle them (e.g. prompt /login).
      if (err instanceof AuthError) throw err;
      console.error("runIteration failed:", err);
      process.exit(1);
    }

    const iterN = i + 1;
    const iterDir = join(workDir, "iter", String(iterN));
    mkdirSync(iterDir, { recursive: true });
    writeFileSync(join(iterDir, "agent.log"), result, "utf8");

    const summary = extractSummary(result);
    await commitIteration(workDir, summary);

    if (isDone(result)) {
      process.exit(0);
    }
  }

  console.error("max iterations reached");
  process.exit(1);
}
