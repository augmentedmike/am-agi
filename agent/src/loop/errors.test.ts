import { describe, test, expect } from "bun:test";
import { ProviderAuthError, ProviderRateLimitError, ProviderTimeoutError } from "./errors";

describe("ProviderAuthError", () => {
  test("sets name, provider, and default message", () => {
    const err = new ProviderAuthError("claude");
    expect(err.name).toBe("ProviderAuthError");
    expect(err.provider).toBe("claude");
    expect(err.message).toBe("claude: authentication failed");
    expect(err).toBeInstanceOf(Error);
  });

  test("accepts custom message", () => {
    const err = new ProviderAuthError("openai", "invalid key");
    expect(err.provider).toBe("openai");
    expect(err.message).toBe("invalid key");
  });
});

describe("ProviderRateLimitError", () => {
  test("sets name, provider, and default message", () => {
    const err = new ProviderRateLimitError("deepseek");
    expect(err.name).toBe("ProviderRateLimitError");
    expect(err.provider).toBe("deepseek");
    expect(err.message).toBe("deepseek: rate limit exceeded");
    expect(err).toBeInstanceOf(Error);
  });

  test("accepts custom message", () => {
    const err = new ProviderRateLimitError("openai", "429 too many requests");
    expect(err.provider).toBe("openai");
    expect(err.message).toBe("429 too many requests");
  });
});

describe("ProviderTimeoutError", () => {
  test("sets name, provider, and default message", () => {
    const err = new ProviderTimeoutError("qwen");
    expect(err.name).toBe("ProviderTimeoutError");
    expect(err.provider).toBe("qwen");
    expect(err.message).toBe("qwen: request timed out");
    expect(err).toBeInstanceOf(Error);
  });

  test("accepts custom message", () => {
    const err = new ProviderTimeoutError("kimi", "connection reset");
    expect(err.provider).toBe("kimi");
    expect(err.message).toBe("connection reset");
  });
});
