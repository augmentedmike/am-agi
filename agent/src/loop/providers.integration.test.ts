/**
 * Integration tests: verify both model adapters (ClaudeAdapter, OpenAICompatibleAdapter)
 * work end-to-end through runIteration(), and that search provider config is
 * correctly threaded through the pipeline.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentAdapter, AdapterInvokeOptions, AdapterResult } from "./adapter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "am-provider-integ-"));
  return realpath(dir);
}

/** Set env vars, run fn (awaiting if async), then restore originals. */
async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/**
 * Create a stub adapter that records calls and returns a canned result.
 */
function createStubAdapter(
  canned: AdapterResult = { exitCode: 0, result: "stub-ok" },
): { adapter: AgentAdapter; calls: { workDir: string; prompt: string; options?: AdapterInvokeOptions }[] } {
  const calls: { workDir: string; prompt: string; options?: AdapterInvokeOptions }[] = [];
  const adapter: AgentAdapter = {
    providerId: "stub",
    modelId: "stub-model",
    async invoke(workDir, prompt, options) {
      calls.push({ workDir, prompt, options });
      return canned;
    },
  };
  return { adapter, calls };
}

// ---------------------------------------------------------------------------
// ClaudeAdapter via fake script
// ---------------------------------------------------------------------------

describe("ClaudeAdapter integration (via runIteration)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Integration test work\nVerify ClaudeAdapter.\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns exitCode 0 and result text from fake claude stdout", async () => {
    const fakeBinDir = join(dir, "fake-bin");
    await mkdir(fakeBinDir);
    const fakeClaude = join(fakeBinDir, "claude");
    // Fake script outputs plain text (non-JSON)
    await writeFile(fakeClaude, '#!/usr/bin/env bash\necho "hello from fake claude"\n');
    const chmod = Bun.spawn(["chmod", "+x", fakeClaude]);
    await chmod.exited;

    const { runIteration } = await import("./index");
    const result = await runIteration(dir, { claudePath: fakeClaude });

    expect(result.exitCode).toBe(0);
    expect(result.result).toContain("hello from fake claude");
  });

  it("normalizes usage from Claude JSON envelope into ClaudeResult.usage", async () => {
    const fakeBinDir = join(dir, "fake-bin");
    await mkdir(fakeBinDir);
    const fakeClaude = join(fakeBinDir, "claude");

    // Fake script outputs a JSON envelope with usage data
    const envelope = JSON.stringify({
      result: "done",
      usage: {
        input_tokens: 1500,
        output_tokens: 300,
        cache_read_input_tokens: 500,
        cache_creation_input_tokens: 200,
      },
    });
    await writeFile(fakeClaude, `#!/usr/bin/env bash\necho '${envelope}'\n`);
    const chmod = Bun.spawn(["chmod", "+x", fakeClaude]);
    await chmod.exited;

    const { runIteration } = await import("./index");
    const result = await runIteration(dir, { claudePath: fakeClaude });

    expect(result.exitCode).toBe(0);
    expect(result.usage).toBeDefined();
    expect(result.usage!.input_tokens).toBe(1500);
    expect(result.usage!.output_tokens).toBe(300);
    expect(result.usage!.cache_read_input_tokens).toBe(500);
    expect(result.usage!.cache_creation_input_tokens).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// OpenAICompatibleAdapter integration (via mock HTTP server)
// ---------------------------------------------------------------------------

describe("OpenAICompatibleAdapter integration (via runIteration)", () => {
  let dir: string;
  let server: ReturnType<typeof Bun.serve> | null = null;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Integration test work\nVerify OpenAI adapter.\n");
  });

  afterEach(async () => {
    if (server) {
      server.stop(true);
      server = null;
    }
    await rm(dir, { recursive: true, force: true });
  });

  it("returns result text from mock OpenAI-compatible server", async () => {
    // Spin up a mock server that responds to /v1/chat/completions
    server = Bun.serve({
      port: 0, // random available port
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
          return Response.json({
            choices: [{ message: { content: "hello from openai mock" } }],
            usage: { prompt_tokens: 100, completion_tokens: 50 },
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    const baseURL = `http://localhost:${server.port}/v1`;

    const { OpenAICompatibleAdapter } = await import("./adapters/openai-compatible");
    const oaiAdapter = new OpenAICompatibleAdapter({
      baseURL,
      apiKey: "test-key",
      providerId: "mock-openai",
      modelId: "mock-model",
    });

    const { runIteration } = await import("./index");
    const result = await runIteration(dir, { agentAdapter: oaiAdapter });

    expect(result.exitCode).toBe(0);
    expect(result.result).toContain("hello from openai mock");
  });

  it("normalizes OpenAI usage into ClaudeResult.usage (snake_case fields)", async () => {
    server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
          return Response.json({
            choices: [{ message: { content: "usage test" } }],
            usage: {
              prompt_tokens: 2000,
              completion_tokens: 400,
              prompt_cache_hit_tokens: 800,
              prompt_cache_miss_tokens: 100,
            },
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    const baseURL = `http://localhost:${server.port}/v1`;

    const { OpenAICompatibleAdapter } = await import("./adapters/openai-compatible");
    const oaiAdapter = new OpenAICompatibleAdapter({
      baseURL,
      apiKey: "test-key",
      providerId: "mock-openai",
      modelId: "mock-model",
    });

    const { runIteration } = await import("./index");
    const result = await runIteration(dir, { agentAdapter: oaiAdapter });

    expect(result.exitCode).toBe(0);
    expect(result.usage).toBeDefined();
    // OpenAI prompt_tokens → ClaudeResult.input_tokens
    expect(result.usage!.input_tokens).toBe(2000);
    // OpenAI completion_tokens → ClaudeResult.output_tokens
    expect(result.usage!.output_tokens).toBe(400);
    // OpenAI cache fields → ClaudeResult cache fields
    expect(result.usage!.cache_read_input_tokens).toBe(800);
    expect(result.usage!.cache_creation_input_tokens).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Adapter selection via env vars
// ---------------------------------------------------------------------------

describe("Adapter selection via environment", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Adapter selection test\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("resolves OpenAICompatibleAdapter when AM_PROVIDER + AM_BASE_URL + AM_API_KEY are set", () => {
    const { queryAdapter } = require("./adapter") as typeof import("./adapter");

    const adapter = queryAdapter(dir, {
      AM_PROVIDER: "deepseek",
      AM_BASE_URL: "https://api.deepseek.com/v1",
      AM_API_KEY: "sk-test",
      AM_MODEL: "deepseek-chat",
    });

    expect(adapter.providerId).toBe("deepseek");
    expect(adapter.modelId).toBe("deepseek-chat");
  });

  it("falls back to ClaudeAdapter when AM_PROVIDER env vars are not set", () => {
    const { queryAdapter } = require("./adapter") as typeof import("./adapter");

    const adapter = queryAdapter(dir, {});
    expect(adapter.providerId).toBe("claude");
  });
});

// ---------------------------------------------------------------------------
// Search provider config pass-through
// ---------------------------------------------------------------------------

describe("Search provider pass-through", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Search provider test\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("passes mcpConfigPath to adapter when TAVILY_API_KEY is set", async () => {
    const { adapter, calls } = createStubAdapter();

    await withEnv(
      {
        TAVILY_API_KEY: "tvly-test-integration",
        EXA_API_KEY: undefined,
        YOU_API_KEY: undefined,
        YOU_FREE_SEARCH: undefined,
        FIRECRAWL_API_KEY: undefined,
      },
      async () => {
        const { runIteration } = await import("./index");
        await runIteration(dir, { agentAdapter: adapter });
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].options?.mcpConfigPath).toBeDefined();
    expect(calls[0].options!.mcpConfigPath!.endsWith("mcp.json")).toBe(true);
  });

  it("does not pass mcpConfigPath when no search providers configured", async () => {
    const { adapter, calls } = createStubAdapter();

    await withEnv(
      {
        TAVILY_API_KEY: undefined,
        EXA_API_KEY: undefined,
        YOU_API_KEY: undefined,
        YOU_FREE_SEARCH: undefined,
        FIRECRAWL_API_KEY: undefined,
      },
      async () => {
        const { runIteration } = await import("./index");
        await runIteration(dir, { agentAdapter: adapter });
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].options?.mcpConfigPath).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Search preference hint in system prompt
// ---------------------------------------------------------------------------

describe("Search preference hint in system prompt", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Search hint test\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("includes preferred provider hint when 2+ search providers are configured", async () => {
    const { adapter, calls } = createStubAdapter();

    await withEnv(
      {
        TAVILY_API_KEY: "tvly-test-hint",
        EXA_API_KEY: "exa-test-hint",
        YOU_API_KEY: undefined,
        YOU_FREE_SEARCH: undefined,
        FIRECRAWL_API_KEY: undefined,
      },
      async () => {
        const { runIteration } = await import("./index");
        await runIteration(dir, { agentAdapter: adapter });
      },
    );

    expect(calls).toHaveLength(1);
    const systemPrompt = calls[0].options?.systemPrompt ?? "";
    // With 2+ providers, round-robin picks one and injects "prefer the X tool"
    expect(systemPrompt).toContain("prefer the");
    expect(systemPrompt).toMatch(/prefer the `(tavily-search|exa-search)` tool/);
  });

  it("does not include preference hint with only 1 search provider", async () => {
    const { adapter, calls } = createStubAdapter();

    await withEnv(
      {
        TAVILY_API_KEY: "tvly-only",
        EXA_API_KEY: undefined,
        YOU_API_KEY: undefined,
        YOU_FREE_SEARCH: undefined,
        FIRECRAWL_API_KEY: undefined,
      },
      async () => {
        const { runIteration } = await import("./index");
        await runIteration(dir, { agentAdapter: adapter });
      },
    );

    expect(calls).toHaveLength(1);
    const systemPrompt = calls[0].options?.systemPrompt ?? "";
    // Single provider → no preference hint
    expect(systemPrompt).not.toContain("prefer the");
  });
});
