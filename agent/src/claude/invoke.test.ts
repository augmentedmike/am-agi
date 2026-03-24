import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, realpath, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractLog, invokeClaudeCode } from "./invoke.ts";
import type { ExecResult } from "../exec.ts";

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "invoke-test-"));
  return realpath(dir);
}

// ---------------------------------------------------------------------------
// extractLog — unit tests
// ---------------------------------------------------------------------------

describe("extractLog", () => {
  it("returns the result field from valid JSON", () => {
    const json = JSON.stringify({ result: "agent did the work", cost: 0.01 });
    expect(extractLog(json)).toBe("agent did the work");
  });

  it("falls back to raw text when result field is absent", () => {
    const json = JSON.stringify({ type: "done" });
    expect(extractLog(json)).toBe(json);
  });

  it("falls back to raw text when input is not JSON", () => {
    expect(extractLog("not json at all")).toBe("not json at all");
  });

  it("returns empty string when result is empty string", () => {
    const json = JSON.stringify({ result: "" });
    // ?? is nullish, not falsy — empty string is returned as-is
    expect(extractLog(json)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// invokeClaudeCode — unit tests with mock exec
// ---------------------------------------------------------------------------

describe("invokeClaudeCode (mock exec)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function makeExec(result: ExecResult) {
    return async (_cmd: string, _opts?: unknown): Promise<ExecResult> => result;
  }

  it("writes output.json with stdout from exec", async () => {
    const stdout = JSON.stringify({ result: "done" });
    const res = await invokeClaudeCode("do work", dir, {
      execFn: makeExec({ stdout, stderr: "", exitCode: 0 }),
    });

    const written = await readFile(join(dir, "output.json"), "utf8");
    expect(written).toBe(stdout);
    expect(res.outputPath).toBe(join(dir, "output.json"));
  });

  it("writes agent.log with extracted log text on success", async () => {
    const stdout = JSON.stringify({ result: "iteration complete" });
    await invokeClaudeCode("do work", dir, {
      execFn: makeExec({ stdout, stderr: "", exitCode: 0 }),
    });

    const log = await readFile(join(dir, "agent.log"), "utf8");
    expect(log).toBe("iteration complete");
  });

  it("returns success=true and the extracted log on exit 0", async () => {
    const stdout = JSON.stringify({ result: "all good" });
    const result = await invokeClaudeCode("do work", dir, {
      execFn: makeExec({ stdout, stderr: "", exitCode: 0 }),
    });

    expect(result.success).toBe(true);
    expect(result.log).toBe("all good");
  });

  it("returns success=false with stderr in log on non-zero exit", async () => {
    const result = await invokeClaudeCode("do work", dir, {
      execFn: makeExec({ stdout: "", stderr: "claude crashed", exitCode: 1 }),
    });

    expect(result.success).toBe(false);
    expect(result.log).toBe("claude crashed");
  });

  it("does not throw on non-zero exit", async () => {
    await expect(
      invokeClaudeCode("do work", dir, {
        execFn: makeExec({ stdout: "", stderr: "error", exitCode: 2 }),
      }),
    ).resolves.toBeDefined();
  });

  it("writes agent.log with stderr on non-zero exit", async () => {
    await invokeClaudeCode("do work", dir, {
      execFn: makeExec({ stdout: "", stderr: "something failed", exitCode: 1 }),
    });

    const log = await readFile(join(dir, "agent.log"), "utf8");
    expect(log).toBe("something failed");
  });

  it("uses fallback message when stderr is empty on failure", async () => {
    const result = await invokeClaudeCode("do work", dir, {
      execFn: makeExec({ stdout: "", stderr: "", exitCode: 127 }),
    });

    expect(result.log).toContain("127");
  });

  it("creates iterDir if it does not exist", async () => {
    const nestedDir = join(dir, "iter", "3");
    await invokeClaudeCode("do work", nestedDir, {
      execFn: makeExec({ stdout: JSON.stringify({ result: "ok" }), stderr: "", exitCode: 0 }),
    });

    const log = await readFile(join(nestedDir, "agent.log"), "utf8");
    expect(log).toBe("ok");
  });
});
