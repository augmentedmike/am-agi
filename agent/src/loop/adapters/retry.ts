import type { AgentAdapter, AdapterInvokeOptions, AdapterResult, AdapterCapabilities } from "../adapter";
import { ProviderAuthError, ProviderRateLimitError, ProviderTimeoutError } from "../errors";

/**
 * Composable retry wrapper for any `AgentAdapter`.
 *
 * - Retries on `ProviderTimeoutError` up to `maxRetries` with exponential backoff.
 * - Immediately re-throws `ProviderAuthError` and `ProviderRateLimitError` (no retry).
 * - All other errors propagate as-is.
 */
export class RetryAdapter implements AgentAdapter {
  readonly providerId: string;
  readonly modelId: string;
  readonly capabilities: AdapterCapabilities;

  private readonly inner: AgentAdapter;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(inner: AgentAdapter, maxRetries = 2, baseDelayMs = 1000) {
    this.inner = inner;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.providerId = inner.providerId;
    this.modelId = inner.modelId;
    this.capabilities = inner.capabilities ?? {
      streaming: false,
      vision: false,
      structuredOutput: false,
    };
  }

  async invoke(
    workDir: string,
    prompt: string,
    options?: AdapterInvokeOptions,
  ): Promise<AdapterResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.inner.invoke(workDir, prompt, options);
      } catch (err) {
        // Never retry auth or rate-limit errors — re-throw immediately
        if (err instanceof ProviderAuthError) throw err;
        if (err instanceof ProviderRateLimitError) throw err;

        if (err instanceof ProviderTimeoutError) {
          lastError = err;
          if (attempt < this.maxRetries) {
            const delay = this.baseDelayMs * 2 ** attempt;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Non-timeout, non-auth, non-ratelimit errors propagate immediately
        throw err;
      }
    }

    // All retries exhausted — throw the last timeout error
    throw lastError;
  }
}
