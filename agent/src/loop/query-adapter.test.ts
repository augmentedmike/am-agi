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

  // ── Hermes adapter resolution ──────────────────────────────────────────────

  test("Hermes via am.project.json: returns OpenAICompatibleAdapter", () => {
    writeFileSync(
      join(tmpDir, "am.project.json"),
      JSON.stringify({
        adapter: {
          provider: "hermes",
          baseURL: "http://localhost:11434/v1",
          apiKey: "ollama",
          model: "NousResearch/Hermes-3-Llama-3.1-8B",
        },
      }),
      "utf8",
    );
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("hermes");
    expect(adapter.modelId).toBe("NousResearch/Hermes-3-Llama-3.1-8B");
  });

  test("Hermes via env vars: returns OpenAICompatibleAdapter", () => {
    const adapter = queryAdapter(tmpDir, {
      AM_PROVIDER: "hermes",
      AM_BASE_URL: "http://localhost:11434/v1",
      AM_API_KEY: "ollama",
      AM_MODEL: "NousResearch/Hermes-3-Llama-3.1-8B",
    });
    expect(adapter.providerId).toBe("hermes");
    expect(adapter.modelId).toBe("NousResearch/Hermes-3-Llama-3.1-8B");
  });

  // ── Qwen3 adapter resolution ──────────────────────────────────────────────

  test("Qwen3 via am.project.json: returns OpenAICompatibleAdapter", () => {
    writeFileSync(
      join(tmpDir, "am.project.json"),
      JSON.stringify({
        adapter: {
          provider: "qwen",
          baseURL: "http://localhost:8080/v1",
          apiKey: "none",
          model: "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit",
        },
      }),
      "utf8",
    );
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("qwen");
    expect(adapter.modelId).toBe("mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit");
  });

  test("Qwen3 via DashScope: returns OpenAICompatibleAdapter with cloud URL", () => {
    writeFileSync(
      join(tmpDir, "am.project.json"),
      JSON.stringify({
        adapter: {
          provider: "qwen",
          baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          apiKey: "sk-test-dashscope",
          model: "qwen3-coder-30b-a3b",
        },
      }),
      "utf8",
    );
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("qwen");
    expect(adapter.modelId).toBe("qwen3-coder-30b-a3b");
  });

  test("Qwen3 via env vars: returns OpenAICompatibleAdapter", () => {
    const adapter = queryAdapter(tmpDir, {
      AM_PROVIDER: "qwen",
      AM_BASE_URL: "http://localhost:11434/v1",
      AM_API_KEY: "ollama",
      AM_MODEL: "qwen3:30b-a3b",
    });
    expect(adapter.providerId).toBe("qwen");
    expect(adapter.modelId).toBe("qwen3:30b-a3b");
  });

  // ── Backward compatibility ────────────────────────────────────────────────

  test("backward compat: no provider config returns ClaudeAdapter by default", () => {
    // No am.project.json, no env vars
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("claude");
    // Default Claude model
    expect(adapter.modelId).toBe("claude-sonnet-4-5");
  });
});
