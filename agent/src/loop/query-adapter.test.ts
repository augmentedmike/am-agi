import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { queryAdapter } from "./adapter";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "am-query-adapter-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("queryAdapter", () => {
  test("no-config fallback: absent am.project.json returns ClaudeAdapter", () => {
    // No file written — should fall back to resolveAdapter(env) → ClaudeAdapter
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("claude");
  });

  test("no-config fallback: empty adapter block returns ClaudeAdapter", () => {
    writeFileSync(join(tmpDir, "am.project.json"), JSON.stringify({}), "utf8");
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("claude");
  });

  test("OpenAI-compatible config: returns OpenAICompatibleAdapter with correct fields", () => {
    writeFileSync(
      join(tmpDir, "am.project.json"),
      JSON.stringify({
        adapter: {
          provider: "deepseek",
          baseURL: "https://api.deepseek.com/v1",
          apiKey: "sk-test-123",
          model: "deepseek-chat",
        },
      }),
      "utf8",
    );
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("deepseek");
    expect(adapter.modelId).toBe("deepseek-chat");
  });

  test("OpenAI-compatible config: uses default model when model omitted", () => {
    writeFileSync(
      join(tmpDir, "am.project.json"),
      JSON.stringify({
        adapter: {
          provider: "myco",
          baseURL: "https://api.myco.ai/v1",
          apiKey: "key-xyz",
        },
      }),
      "utf8",
    );
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("myco");
    expect(adapter.modelId).toBe("gpt-4o");
  });

  test("Claude config: provider=claude without baseURL/apiKey returns ClaudeAdapter", () => {
    writeFileSync(
      join(tmpDir, "am.project.json"),
      JSON.stringify({ adapter: { provider: "claude" } }),
      "utf8",
    );
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("claude");
  });

  test("Claude config: no provider, no baseURL/apiKey returns ClaudeAdapter", () => {
    writeFileSync(
      join(tmpDir, "am.project.json"),
      JSON.stringify({ adapter: {} }),
      "utf8",
    );
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("claude");
  });

  test("malformed JSON: does not throw, returns ClaudeAdapter", () => {
    writeFileSync(join(tmpDir, "am.project.json"), "{ this is not valid json }", "utf8");
    expect(() => queryAdapter(tmpDir, {})).not.toThrow();
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("claude");
  });

  test("env fallback: when no project config, env vars are still honoured", () => {
    // If AM_PROVIDER + AM_BASE_URL + AM_API_KEY are set, resolveAdapter picks them up
    const adapter = queryAdapter(tmpDir, {
      AM_PROVIDER: "envprovider",
      AM_BASE_URL: "https://env.example.com/v1",
      AM_API_KEY: "env-key",
      AM_MODEL: "env-model",
    });
    expect(adapter.providerId).toBe("envprovider");
    expect(adapter.modelId).toBe("env-model");
  });
});
