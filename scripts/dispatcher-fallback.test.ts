import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { RateLimitError } from "../agent/src/loop/invoke-claude.ts";
import {
  runCard,
  _setAgentSettings,
  _isUsingFallback,
  _resetFallbackState,
  activateFallback,
  deactivateFallback,
  isFallbackEnabled,
} from "../bin/dispatcher";
import type { RunCardDeps } from "../bin/dispatcher";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "dispatcher-fallback-test-"));
  return realpath(dir);
}

async function initGitRepo(dir: string): Promise<void> {
  spawnSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "pipe", env: process.env });
  spawnSync("git", ["config", "user.email", "test@test.com"], { cwd: dir, stdio: "pipe", env: process.env });
  spawnSync("git", ["config", "user.name", "Test"], { cwd: dir, stdio: "pipe", env: process.env });
  await writeFile(join(dir, "work.md"), "# test\n");
  spawnSync("git", ["add", "-A"], { cwd: dir, stdio: "pipe", env: process.env });
  spawnSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "pipe", env: process.env });
}

function fakeCard(
  repoRoot: string,
  overrides: Partial<{ id: string; title: string; state: string; priority: string }> = {},
) {
  return {
    id: overrides.id ?? "test-fallback-card",
    title: overrides.title ?? "Test card",
    state: (overrides.state ?? "in-progress") as any,
    priority: (overrides.priority ?? "normal") as any,
    workDir: repoRoot,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("dispatcher fallback — isFallbackEnabled", () => {
  beforeEach(() => {
    _resetFallbackState();
  });

  afterEach(() => {
    _resetFallbackState();
  });

  it("returns true when extra_usage_fallback is 'true'", () => {
    _setAgentSettings({ extra_usage_fallback: "true" });
    expect(isFallbackEnabled()).toBe(true);
  });

  it("returns true when extra_usage_fallback is not set (default)", () => {
    _setAgentSettings({});
    expect(isFallbackEnabled()).toBe(true);
  });

  it("returns false when extra_usage_fallback is 'false'", () => {
    _setAgentSettings({ extra_usage_fallback: "false" });
    expect(isFallbackEnabled()).toBe(false);
  });
});

describe("dispatcher fallback — activateFallback / deactivateFallback", () => {
  beforeEach(() => {
    _resetFallbackState();
    _setAgentSettings({
      agent_provider: "claude",
      agent_model_hermes: "qwen3-coder-30b-a3b",
      hermes_base_url: "http://localhost:1234/v1",
      hermes_api_key: "lm-studio",
      extra_usage_fallback: "true",
    });
  });

  afterEach(() => {
    _resetFallbackState();
  });

  it("activateFallback sets usingFallback to true", () => {
    expect(_isUsingFallback()).toBe(false);
    activateFallback();
    expect(_isUsingFallback()).toBe(true);
  });

  it("deactivateFallback sets usingFallback to false", () => {
    activateFallback();
    expect(_isUsingFallback()).toBe(true);
    deactivateFallback();
    expect(_isUsingFallback()).toBe(false);
  });

  it("activateFallback is idempotent", () => {
    activateFallback();
    activateFallback();
    expect(_isUsingFallback()).toBe(true);
  });

  it("deactivateFallback is idempotent when not active", () => {
    deactivateFallback();
    expect(_isUsingFallback()).toBe(false);
  });
});

describe("dispatcher fallback — RateLimitError with fallback enabled", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await makeTempDir();
    await initGitRepo(repoRoot);
    _resetFallbackState();
    _setAgentSettings({
      agent_provider: "claude",
      extra_usage_fallback: "true",
      hermes_base_url: "http://localhost:1234/v1",
      hermes_api_key: "lm-studio",
      agent_model_hermes: "qwen3-coder-30b-a3b",
    });
  });

  afterEach(async () => {
    _resetFallbackState();
    await rm(repoRoot, { recursive: true, force: true });
  });

  it("activates fallback when RateLimitError is thrown and fallback is enabled", async () => {
    const boardUpdates: Array<{ id: string; msg: string }> = [];
    const resetAt = new Date(Date.now() + 3_600_000);

    const deps: RunCardDeps = {
      ensureWorktreeFn: () => repoRoot,
      runIterationFn: async () => {
        throw new RateLimitError(resetAt);
      },
      boardUpdateFn: (id, msg) => boardUpdates.push({ id, msg }),
    };

    await runCard(fakeCard(repoRoot), deps);

    expect(_isUsingFallback()).toBe(true);
    expect(boardUpdates.length).toBe(1);
    expect(boardUpdates[0].msg.toLowerCase()).toContain("fallback");
  });

  it("does NOT activate fallback when extra_usage_fallback is false", async () => {
    _setAgentSettings({ extra_usage_fallback: "false" });

    const boardUpdates: Array<{ id: string; msg: string }> = [];
    const resetAt = new Date(Date.now() + 3_600_000);

    const deps: RunCardDeps = {
      ensureWorktreeFn: () => repoRoot,
      runIterationFn: async () => {
        throw new RateLimitError(resetAt);
      },
      boardUpdateFn: (id, msg) => boardUpdates.push({ id, msg }),
    };

    await runCard(fakeCard(repoRoot), deps);

    expect(_isUsingFallback()).toBe(false);
    expect(boardUpdates[0].msg.toLowerCase()).toContain("paused");
  });

  it("board message mentions hermes when fallback activates", async () => {
    const boardUpdates: Array<{ id: string; msg: string }> = [];
    const resetAt = new Date(Date.now() + 3_600_000);

    const deps: RunCardDeps = {
      ensureWorktreeFn: () => repoRoot,
      runIterationFn: async () => {
        throw new RateLimitError(resetAt);
      },
      boardUpdateFn: (id, msg) => boardUpdates.push({ id, msg }),
    };

    await runCard(fakeCard(repoRoot), deps);

    expect(boardUpdates[0].msg.toLowerCase()).toContain("hermes");
  });

  it("resolves without throwing when RateLimitError triggers fallback", async () => {
    const resetAt = new Date(Date.now() + 3_600_000);

    const deps: RunCardDeps = {
      ensureWorktreeFn: () => repoRoot,
      runIterationFn: async () => {
        throw new RateLimitError(resetAt);
      },
      boardUpdateFn: () => {},
    };

    await expect(runCard(fakeCard(repoRoot), deps)).resolves.toBeUndefined();
  });
});
