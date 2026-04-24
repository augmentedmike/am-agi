import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { queryAdapter, resolveAdapter, buildFallbackAdapter } from "./adapter";
import type { AgentSettings } from "./adapter";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "am-adapter-settings-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// resolveAdapter with settings
// ---------------------------------------------------------------------------

describe("resolveAdapter with settings", () => {
  test("settings with agent_provider=claude returns ClaudeAdapter with configured model", () => {
    const settings: AgentSettings = {
      agent_provider: "claude",
      agent_model_claude: "claude-opus-4",
    };
    const adapter = resolveAdapter({}, settings);
    expect(adapter.providerId).toBe("claude");
    expect(adapter.modelId).toBe("claude-opus-4");
  });

  test("settings with agent_provider=claude uses default model when not specified", () => {
    const settings: AgentSettings = {
      agent_provider: "claude",
    };
    const adapter = resolveAdapter({}, settings);
    expect(adapter.providerId).toBe("claude");
    expect(adapter.modelId).toBe("claude-sonnet-4-5");
  });

  test("settings with agent_provider=hermes returns OpenAICompatibleAdapter", () => {
    const settings: AgentSettings = {
      agent_provider: "hermes",
      agent_model_hermes: "qwen3-coder-30b-a3b",
      hermes_base_url: "http://localhost:1234/v1",
      hermes_api_key: "lm-studio",
    };
    const adapter = resolveAdapter({}, settings);
    expect(adapter.providerId).toBe("hermes");
    expect(adapter.modelId).toBe("qwen3-coder-30b-a3b");
  });

  test("settings with agent_provider=hermes uses defaults when fields are missing", () => {
    const settings: AgentSettings = {
      agent_provider: "hermes",
    };
    const adapter = resolveAdapter({}, settings);
    expect(adapter.providerId).toBe("hermes");
    expect(adapter.modelId).toBe("qwen3-coder-30b-a3b");
  });

  test("settings take priority over env vars when both present", () => {
    const settings: AgentSettings = {
      agent_provider: "hermes",
      agent_model_hermes: "qwen3-coder-30b-a3b",
    };
    const env = {
      AM_PROVIDER: "deepseek",
      AM_BASE_URL: "https://api.deepseek.com/v1",
      AM_API_KEY: "sk-test",
      AM_MODEL: "deepseek-chat",
    };
    const adapter = resolveAdapter(env, settings);
    expect(adapter.providerId).toBe("hermes");
  });

  test("no settings falls through to env vars", () => {
    const env = {
      AM_PROVIDER: "deepseek",
      AM_BASE_URL: "https://api.deepseek.com/v1",
      AM_API_KEY: "sk-test",
      AM_MODEL: "deepseek-chat",
    };
    const adapter = resolveAdapter(env);
    expect(adapter.providerId).toBe("deepseek");
    expect(adapter.modelId).toBe("deepseek-chat");
  });

  test("no settings and no env vars returns ClaudeAdapter default", () => {
    const adapter = resolveAdapter({});
    expect(adapter.providerId).toBe("claude");
    expect(adapter.modelId).toBe("claude-sonnet-4-5");
  });
});

// ---------------------------------------------------------------------------
// queryAdapter with settings (resolution order)
// ---------------------------------------------------------------------------

describe("queryAdapter resolution order with settings", () => {
  test("am.project.json takes priority over settings", () => {
    writeFileSync(
      join(tmpDir, "am.project.json"),
      JSON.stringify({
        adapter: {
          provider: "deepseek",
          baseURL: "https://api.deepseek.com/v1",
          apiKey: "sk-test",
          model: "deepseek-chat",
        },
      }),
      "utf8",
    );
    const settings: AgentSettings = {
      agent_provider: "hermes",
      agent_model_hermes: "qwen3-coder-30b-a3b",
    };
    const adapter = queryAdapter(tmpDir, {}, settings);
    expect(adapter.providerId).toBe("deepseek");
  });

  test("settings take priority over env vars when no am.project.json", () => {
    const settings: AgentSettings = {
      agent_provider: "hermes",
    };
    const env = {
      AM_PROVIDER: "deepseek",
      AM_BASE_URL: "https://api.deepseek.com/v1",
      AM_API_KEY: "sk-test",
    };
    const adapter = queryAdapter(tmpDir, env, settings);
    expect(adapter.providerId).toBe("hermes");
  });

  test("env vars used when no am.project.json and no settings", () => {
    const env = {
      AM_PROVIDER: "envprovider",
      AM_BASE_URL: "https://env.example.com/v1",
      AM_API_KEY: "env-key",
      AM_MODEL: "env-model",
    };
    const adapter = queryAdapter(tmpDir, env);
    expect(adapter.providerId).toBe("envprovider");
  });

  test("default ClaudeAdapter when no config, no settings, no env", () => {
    const adapter = queryAdapter(tmpDir, {});
    expect(adapter.providerId).toBe("claude");
  });
});

// ---------------------------------------------------------------------------
// buildFallbackAdapter
// ---------------------------------------------------------------------------

describe("buildFallbackAdapter", () => {
  test("returns hermes adapter with provided settings", () => {
    const settings: AgentSettings = {
      agent_model_hermes: "qwen3-coder-30b-a3b",
      hermes_base_url: "http://localhost:8080/v1",
      hermes_api_key: "test-key",
    };
    const adapter = buildFallbackAdapter(settings);
    expect(adapter.providerId).toBe("hermes");
    expect(adapter.modelId).toBe("qwen3-coder-30b-a3b");
  });

  test("returns hermes adapter with defaults when settings are empty", () => {
    const adapter = buildFallbackAdapter({});
    expect(adapter.providerId).toBe("hermes");
    expect(adapter.modelId).toBe("qwen3-coder-30b-a3b");
  });

  test("always returns hermes regardless of agent_provider setting", () => {
    const settings: AgentSettings = {
      agent_provider: "claude",
      agent_model_claude: "claude-opus-4",
    };
    const adapter = buildFallbackAdapter(settings);
    expect(adapter.providerId).toBe("hermes");
  });

  test("uses custom hermes model when specified", () => {
    const settings: AgentSettings = {
      agent_model_hermes: "qwen3-8b",
      hermes_base_url: "http://192.168.1.100:1234/v1",
      hermes_api_key: "custom-key",
    };
    const adapter = buildFallbackAdapter(settings);
    expect(adapter.modelId).toBe("qwen3-8b");
  });
});
