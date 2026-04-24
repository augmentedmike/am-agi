import { describe, test, expect, mock } from "bun:test";
import { RetryAdapter } from "./retry";
import { ProviderAuthError, ProviderRateLimitError, ProviderTimeoutError } from "../errors";
import type { AgentAdapter, AdapterInvokeOptions, AdapterResult, AdapterCapabilities } from "../adapter";

/** Create a mock adapter with a configurable invoke function. */
function mockAdapter(invokeFn: AgentAdapter["invoke"]): AgentAdapter {
  return {
    providerId: "test",
    modelId: "test-model",
    capabilities: { streaming: false, vision: false, structuredOutput: false },
    invoke: invokeFn,
  };
}

const okResult: AdapterResult = { exitCode: 0, result: "ok" };

describe("RetryAdapter", () => {
  test("passes through on first success", async () => {
    const invoke = mock(() => Promise.resolve(okResult));
    const adapter = new RetryAdapter(mockAdapter(invoke));

    const result = await adapter.invoke("/tmp", "hello");
    expect(result).toEqual(okResult);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  test("retries on ProviderTimeoutError", async () => {
    let calls = 0;
    const invoke = mock(async () => {
      calls++;
      if (calls < 3) throw new ProviderTimeoutError("test", "timed out");
      return okResult;
    });

    // maxRetries=2, baseDelay=1 to keep test fast
    const adapter = new RetryAdapter(mockAdapter(invoke), 2, 1);
    const result = await adapter.invoke("/tmp", "hello");

    expect(result).toEqual(okResult);
    expect(invoke).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  test("does not retry on ProviderAuthError", async () => {
    const invoke = mock(async () => {
      throw new ProviderAuthError("test", "bad credentials");
    });

    const adapter = new RetryAdapter(mockAdapter(invoke), 3, 1);

    await expect(adapter.invoke("/tmp", "hello")).rejects.toThrow(ProviderAuthError);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  test("does not retry on ProviderRateLimitError", async () => {
    const invoke = mock(async () => {
      throw new ProviderRateLimitError("test", "429");
    });

    const adapter = new RetryAdapter(mockAdapter(invoke), 3, 1);

    await expect(adapter.invoke("/tmp", "hello")).rejects.toThrow(ProviderRateLimitError);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  test("throws after max retries exceeded on timeout", async () => {
    const invoke = mock(async () => {
      throw new ProviderTimeoutError("test", "always times out");
    });

    // maxRetries=2 means 3 total attempts (initial + 2 retries)
    const adapter = new RetryAdapter(mockAdapter(invoke), 2, 1);

    await expect(adapter.invoke("/tmp", "hello")).rejects.toThrow(ProviderTimeoutError);
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  test("delegates providerId, modelId, and capabilities from inner adapter", () => {
    const inner = mockAdapter(async () => okResult);
    const adapter = new RetryAdapter(inner);

    expect(adapter.providerId).toBe("test");
    expect(adapter.modelId).toBe("test-model");
    expect(adapter.capabilities).toEqual({
      streaming: false,
      vision: false,
      structuredOutput: false,
    });
  });

  test("propagates non-timeout errors immediately without retry", async () => {
    const invoke = mock(async () => {
      throw new Error("unexpected failure");
    });

    const adapter = new RetryAdapter(mockAdapter(invoke), 3, 1);

    await expect(adapter.invoke("/tmp", "hello")).rejects.toThrow("unexpected failure");
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
