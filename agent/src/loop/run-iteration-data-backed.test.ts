/**
 * Integration / mock-based test verifying that runIteration() calls
 * init() before buildPrompt() and close() after invoke() for adapters
 * that implement DataBackedAdapter.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runIteration } from "./index";
import type { AgentAdapter, AdapterResult } from "./adapter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeWorktree(dir: string): Promise<void> {
  // runIteration refuses to run in a main-repo root (where .git is a directory).
  // A real worktree has .git as a file pointing to the main repo's .git dir.
  // We simulate that by writing a .git file.
  writeFileSync(join(dir, ".git"), "gitdir: /tmp/fake-main/.git/worktrees/fake\n");
  await writeFile(join(dir, "work.md"), "# Test task\n");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runIteration — DataBackedAdapter integration", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "run-iter-test-"));
    await makeWorktree(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("calls init() before buildPrompt() and close() after invoke()", async () => {
    const callOrder: string[] = [];

    // A mock DataBackedAdapter that records call order
    const adapter = {
      adapterId: "mock",
      async init(_workDir: string): Promise<void> {
        callOrder.push("init");
      },
      close(): void {
        callOrder.push("close");
      },
      buildSystemPrompt(): string {
        callOrder.push("buildSystemPrompt");
        return "system prompt";
      },
      buildPrompt(): string {
        callOrder.push("buildPrompt");
        return "user prompt";
      },
    };

    // A mock AgentAdapter that records when invoke is called
    const mockAgentAdapter: AgentAdapter = {
      providerId: "mock",
      modelId: "mock-model",
      async invoke(_workDir, _prompt, _opts): Promise<AdapterResult> {
        callOrder.push("invoke");
        return { exitCode: 0, result: "done", usage: undefined };
      },
    };

    await runIteration(dir, { adapter, agentAdapter: mockAgentAdapter });

    // init must come before buildPrompt
    const initIdx = callOrder.indexOf("init");
    const buildPromptIdx = callOrder.indexOf("buildPrompt");
    const invokeIdx = callOrder.indexOf("invoke");
    const closeIdx = callOrder.indexOf("close");

    expect(initIdx).toBeGreaterThanOrEqual(0);
    expect(initIdx).toBeLessThan(buildPromptIdx);
    expect(invokeIdx).toBeGreaterThan(buildPromptIdx);
    expect(closeIdx).toBeGreaterThan(invokeIdx);
  });

  it("calls close() even when invoke() throws", async () => {
    const closeCalled: boolean[] = [];

    const adapter = {
      adapterId: "mock",
      async init(_workDir: string): Promise<void> {},
      close(): void {
        closeCalled.push(true);
      },
      buildSystemPrompt(): string {
        return "system prompt";
      },
      buildPrompt(): string {
        return "user prompt";
      },
    };

    const mockAgentAdapter: AgentAdapter = {
      providerId: "mock",
      modelId: "mock-model",
      async invoke(): Promise<AdapterResult> {
        throw new Error("invoke exploded");
      },
    };

    await expect(
      runIteration(dir, { adapter, agentAdapter: mockAgentAdapter }),
    ).rejects.toThrow("invoke exploded");

    expect(closeCalled).toHaveLength(1);
  });
});
