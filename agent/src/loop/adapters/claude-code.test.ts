import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeCodeAdapter } from "./claude-code";
import { AuthError, RateLimitError } from "../invoke-claude";

// Mock the @anthropic-ai/claude-agent-sdk module
let mockQueryMessages: any[] = [];
let mockQueryError: Error | null = null;
let capturedQueryArgs: { prompt: string; options: any } | null = null;

mock.module("@anthropic-ai/claude-agent-sdk", () => ({
  query: (args: any) => {
    capturedQueryArgs = args;
    return {
      [Symbol.asyncIterator]() {
        let index = 0;
        return {
          async next() {
            if (mockQueryError) {
              throw mockQueryError;
            }
            if (index < mockQueryMessages.length) {
              return { done: false, value: mockQueryMessages[index++] };
            }
            return { done: true, value: undefined };
          },
        };
      },
    };
  },
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "am-claude-code-test-"));
  mockQueryMessages = [];
  mockQueryError = null;
  capturedQueryArgs = null;
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("ClaudeCodeAdapter", () => {
  test("providerId is 'claude-code'", () => {
    const adapter = new ClaudeCodeAdapter();
    expect(adapter.providerId).toBe("claude-code");
  });

  test("default modelId is 'claude-sonnet-4-5'", () => {
    const adapter = new ClaudeCodeAdapter();
    expect(adapter.modelId).toBe("claude-sonnet-4-5");
  });

  test("accepts custom modelId", () => {
    const adapter = new ClaudeCodeAdapter("claude-opus-4-5");
    expect(adapter.modelId).toBe("claude-opus-4-5");
  });

  test("invoke: extracts result and usage from success message", async () => {
    mockQueryMessages = [
      {
        type: "result",
        subtype: "success",
        result: "hello world",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 20,
          cache_creation_input_tokens: 10,
        },
      },
    ];

    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.invoke(tmpDir, "say hello");

    expect(result.exitCode).toBe(0);
    expect(result.result).toBe("hello world");
    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 20,
      cacheWriteTokens: 10,
    });
  });

  test("invoke: passes cwd, model, systemPrompt to SDK", async () => {
    mockQueryMessages = [
      { type: "result", subtype: "success", result: "ok", usage: null },
    ];

    const adapter = new ClaudeCodeAdapter("claude-opus-4-5");
    await adapter.invoke(tmpDir, "test prompt", {
      systemPrompt: "you are a test bot",
      model: "claude-haiku-3-5",
    });

    expect(capturedQueryArgs).not.toBeNull();
    expect(capturedQueryArgs!.prompt).toBe("test prompt");
    expect(capturedQueryArgs!.options.cwd).toBe(tmpDir);
    expect(capturedQueryArgs!.options.model).toBe("claude-haiku-3-5");
    expect(capturedQueryArgs!.options.systemPrompt).toBe("you are a test bot");
    expect(capturedQueryArgs!.options.permissionMode).toBe("bypassPermissions");
    expect(capturedQueryArgs!.options.allowDangerouslySkipPermissions).toBe(true);
    expect(capturedQueryArgs!.options.persistSession).toBe(false);
  });

  test("invoke: uses adapter modelId when no model override", async () => {
    mockQueryMessages = [
      { type: "result", subtype: "success", result: "ok", usage: null },
    ];

    const adapter = new ClaudeCodeAdapter("claude-opus-4-5");
    await adapter.invoke(tmpDir, "test");

    expect(capturedQueryArgs!.options.model).toBe("claude-opus-4-5");
  });

  test("invoke: returns exitCode 1 for error results", async () => {
    mockQueryMessages = [
      {
        type: "result",
        subtype: "error_during_execution",
        errors: ["something went wrong", "another error"],
        usage: { input_tokens: 50, output_tokens: 10 },
      },
    ];

    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.invoke(tmpDir, "fail");

    expect(result.exitCode).toBe(1);
    expect(result.result).toBe("something went wrong\nanother error");
  });

  test("invoke: throws RateLimitError on rejected rate_limit_event", async () => {
    mockQueryMessages = [
      {
        type: "rate_limit_event",
        rate_limit_info: {
          status: "rejected",
          resetsAt: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    ];

    const adapter = new ClaudeCodeAdapter();
    await expect(adapter.invoke(tmpDir, "test")).rejects.toBeInstanceOf(RateLimitError);
  });

  test("invoke: throws AuthError on auth_status error", async () => {
    mockQueryMessages = [
      {
        type: "auth_status",
        isAuthenticating: false,
        output: [],
        error: "Not logged in",
      },
    ];

    const adapter = new ClaudeCodeAdapter();
    await expect(adapter.invoke(tmpDir, "test")).rejects.toBeInstanceOf(AuthError);
  });

  test("invoke: throws AuthError when SDK error matches auth patterns", async () => {
    mockQueryError = new Error("Not logged in to Claude");

    const adapter = new ClaudeCodeAdapter();
    await expect(adapter.invoke(tmpDir, "test")).rejects.toBeInstanceOf(AuthError);
  });

  test("invoke: returns error result for generic SDK errors", async () => {
    mockQueryError = new Error("network timeout");

    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.invoke(tmpDir, "test");

    expect(result.exitCode).toBe(1);
    expect(result.result).toContain("network timeout");
    expect(result.usage).toBeUndefined();
  });

  test("invoke: reads and passes MCP config from file", async () => {
    const mcpConfig = {
      mcpServers: {
        "tavily": { command: "npx", args: ["tavily-mcp-server"] },
      },
    };
    const mcpPath = join(tmpDir, "mcp.json");
    writeFileSync(mcpPath, JSON.stringify(mcpConfig), "utf8");

    mockQueryMessages = [
      { type: "result", subtype: "success", result: "ok", usage: null },
    ];

    const adapter = new ClaudeCodeAdapter();
    await adapter.invoke(tmpDir, "test", { mcpConfigPath: mcpPath });

    expect(capturedQueryArgs!.options.mcpServers).toEqual({
      "tavily": { command: "npx", args: ["tavily-mcp-server"] },
    });
  });

  test("invoke: handles missing MCP config file gracefully", async () => {
    mockQueryMessages = [
      { type: "result", subtype: "success", result: "ok", usage: null },
    ];

    const adapter = new ClaudeCodeAdapter();
    await adapter.invoke(tmpDir, "test", { mcpConfigPath: "/nonexistent/mcp.json" });

    // Should not throw and should not pass mcpServers
    expect(capturedQueryArgs!.options.mcpServers).toBeUndefined();
  });

  test("invoke: forwards events to onEvent callback", async () => {
    mockQueryMessages = [
      {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "hi" }] },
      },
      {
        type: "result",
        subtype: "success",
        result: "done",
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    ];

    const events: any[] = [];
    const adapter = new ClaudeCodeAdapter();
    await adapter.invoke(tmpDir, "test", {
      onEvent: (ev) => events.push(ev),
    });

    expect(events.length).toBe(2);
    expect(events[0].type).toBe("assistant");
    expect(events[0].message.role).toBe("assistant");
    expect(events[1].type).toBe("result");
    expect(events[1].result).toBe("done");
    expect(events[1].usage).toEqual({
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: undefined,
      cache_creation_input_tokens: undefined,
    });
  });

  test("invoke: does not forward unknown message types to onEvent", async () => {
    mockQueryMessages = [
      { type: "unknown_type", data: "something" },
      { type: "result", subtype: "success", result: "ok", usage: null },
    ];

    const events: any[] = [];
    const adapter = new ClaudeCodeAdapter();
    await adapter.invoke(tmpDir, "test", {
      onEvent: (ev) => events.push(ev),
    });

    // Only the result event should be forwarded
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("result");
  });

  test("invoke: handles result with no usage gracefully", async () => {
    mockQueryMessages = [
      { type: "result", subtype: "success", result: "ok" },
    ];

    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.invoke(tmpDir, "test");

    expect(result.exitCode).toBe(0);
    expect(result.result).toBe("ok");
    expect(result.usage).toBeUndefined();
  });

  test("invoke: RateLimitError uses fallback resetAt when resetsAt missing", async () => {
    mockQueryMessages = [
      {
        type: "rate_limit_event",
        rate_limit_info: { status: "rejected" },
      },
    ];

    const before = Date.now();
    const adapter = new ClaudeCodeAdapter();

    try {
      await adapter.invoke(tmpDir, "test");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      // Fallback is now + 1 hour
      expect((err as RateLimitError).resetAt.getTime()).toBeGreaterThanOrEqual(before + 3_500_000);
    }
  });

  test("invoke: does not set systemPrompt in SDK options when not provided", async () => {
    mockQueryMessages = [
      { type: "result", subtype: "success", result: "ok", usage: null },
    ];

    const adapter = new ClaudeCodeAdapter();
    await adapter.invoke(tmpDir, "test", {});

    expect(capturedQueryArgs!.options.systemPrompt).toBeUndefined();
  });

  test("invoke: rate_limit_event with status 'allowed' does not throw", async () => {
    mockQueryMessages = [
      {
        type: "rate_limit_event",
        rate_limit_info: { status: "allowed", utilization: 0.3 },
      },
      { type: "result", subtype: "success", result: "ok", usage: null },
    ];

    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.invoke(tmpDir, "test");

    expect(result.exitCode).toBe(0);
    expect(result.result).toBe("ok");
  });
});
