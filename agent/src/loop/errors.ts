/**
 * Provider-agnostic error types for the adapter layer.
 *
 * All adapters re-throw provider-specific errors as one of these types
 * so the agent loop can handle them uniformly (retry, pause, abort).
 */

/** Thrown when the provider rejects the request due to invalid credentials. */
export class ProviderAuthError extends Error {
  readonly provider: string;

  constructor(provider: string, message?: string) {
    super(message ?? `${provider}: authentication failed`);
    this.name = "ProviderAuthError";
    this.provider = provider;
  }
}

/** Thrown when the provider returns a rate-limit response (HTTP 429). */
export class ProviderRateLimitError extends Error {
  readonly provider: string;

  constructor(provider: string, message?: string) {
    super(message ?? `${provider}: rate limit exceeded`);
    this.name = "ProviderRateLimitError";
    this.provider = provider;
  }
}

/** Thrown when the provider request times out or the connection is lost. */
export class ProviderTimeoutError extends Error {
  readonly provider: string;

  constructor(provider: string, message?: string) {
    super(message ?? `${provider}: request timed out`);
    this.name = "ProviderTimeoutError";
    this.provider = provider;
  }
}
