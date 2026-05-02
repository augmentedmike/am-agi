import { describe, expect, it } from "bun:test";

import { normalizeProvider, resolveProviderConfig } from "./provider.ts";

describe("am-cli provider config", () => {
  it("defaults to codex with OpenAI auth", () => {
    const config = resolveProviderConfig({ env: { OPENAI_API_KEY: "sk-test" } });
    expect(config.provider).toBe("codex");
    expect(config.baseUrl).toBe("https://api.openai.com/v1");
    expect(config.apiKey).toBe("sk-test");
  });

  it("resolves deepseek defaults", () => {
    const config = resolveProviderConfig({
      provider: "deepseek",
      env: { DEEPSEEK_API_KEY: "deepseek-key" },
    });
    expect(config.model).toBe("deepseek-chat");
    expect(config.baseUrl).toBe("https://api.deepseek.com/v1");
  });

  it("resolves qwen via DashScope-compatible endpoint", () => {
    const config = resolveProviderConfig({
      provider: "qwen",
      env: { DASHSCOPE_API_KEY: "qwen-key" },
    });
    expect(config.model).toBe("qwen3-coder-plus");
    expect(config.baseUrl).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
  });

  it("allows local without an API key", () => {
    const config = resolveProviderConfig({ provider: "local", env: {} });
    expect(config.apiKey).toBe("not-needed");
  });

  it("rejects unknown providers", () => {
    expect(() => normalizeProvider("claude-code")).toThrow("unknown provider");
  });
});
