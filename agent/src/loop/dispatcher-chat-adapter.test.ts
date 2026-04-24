import { describe, test, expect } from "bun:test";
import { resolveAdapter } from "./adapter";

/**
 * Tests that the dispatcher's chat adapter resolution works correctly.
 *
 * The dispatcher calls `resolveAdapter()` at startup to get the chat adapter.
 * These tests verify that:
 *  - Default (no env vars) returns ClaudeAdapter
 *  - Hermes env vars return OpenAICompatibleAdapter with correct config
 *  - Qwen env vars return OpenAICompatibleAdapter with correct config
 *  - The adapter's modelId is used instead of a hardcoded model string
 */
describe("dispatcher chat adapter integration", () => {
  test("default: resolveAdapter() returns ClaudeAdapter for chat", () => {
    const adapter = resolveAdapter({});
    expect(adapter.providerId).toBe("claude");
    expect(adapter.modelId).toBe("claude-sonnet-4-5");
    expect(typeof adapter.invoke).toBe("function");
  });

  test("hermes provider: resolveAdapter() returns OpenAICompatibleAdapter", () => {
    const adapter = resolveAdapter({
      AM_PROVIDER: "hermes",
      AM_BASE_URL: "http://localhost:11434/v1",
      AM_API_KEY: "ollama",
      AM_MODEL: "NousResearch/Hermes-3-Llama-3.1-8B",
    });
    expect(adapter.providerId).toBe("hermes");
    expect(adapter.modelId).toBe("NousResearch/Hermes-3-Llama-3.1-8B");
    expect(typeof adapter.invoke).toBe("function");
  });

  test("qwen provider: resolveAdapter() returns OpenAICompatibleAdapter", () => {
    const adapter = resolveAdapter({
      AM_PROVIDER: "qwen",
      AM_BASE_URL: "http://localhost:8080/v1",
      AM_API_KEY: "none",
      AM_MODEL: "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit",
    });
    expect(adapter.providerId).toBe("qwen");
    expect(adapter.modelId).toBe("mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit");
    expect(typeof adapter.invoke).toBe("function");
  });

  test("adapter modelId replaces hardcoded CHAT_MODEL", () => {
    // The dispatcher previously hardcoded "claude-haiku-4-5-20251001".
    // Now it uses chatAdapter.modelId. Verify different providers yield different model IDs.
    const claude = resolveAdapter({});
    const hermes = resolveAdapter({
      AM_PROVIDER: "hermes",
      AM_BASE_URL: "http://localhost:11434/v1",
      AM_API_KEY: "ollama",
      AM_MODEL: "hermes-3-8b",
    });
    expect(claude.modelId).not.toBe(hermes.modelId);
    expect(hermes.modelId).toBe("hermes-3-8b");
  });

  test("AM_PROVIDER without base URL/API key: falls back to ClaudeAdapter", () => {
    // If only AM_PROVIDER is set but not the required connection params,
    // resolveAdapter falls back to Claude (backward compat).
    const adapter = resolveAdapter({ AM_PROVIDER: "hermes" });
    expect(adapter.providerId).toBe("claude");
  });

  test("all three env vars required for non-Claude adapter", () => {
    // Missing AM_API_KEY
    const a1 = resolveAdapter({ AM_PROVIDER: "qwen", AM_BASE_URL: "http://localhost:8080/v1" });
    expect(a1.providerId).toBe("claude");

    // Missing AM_BASE_URL
    const a2 = resolveAdapter({ AM_PROVIDER: "qwen", AM_API_KEY: "key" });
    expect(a2.providerId).toBe("claude");

    // All present — should resolve to qwen
    const a3 = resolveAdapter({ AM_PROVIDER: "qwen", AM_BASE_URL: "http://localhost:8080/v1", AM_API_KEY: "key" });
    expect(a3.providerId).toBe("qwen");
  });
});
