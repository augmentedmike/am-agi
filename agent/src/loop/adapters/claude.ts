import { invokeClaude, AuthError, RateLimitError } from "../invoke-claude";
import type { AgentAdapter, AdapterInvokeOptions, AdapterResult, AdapterCapabilities } from "../adapter";
import { ProviderAuthError, ProviderRateLimitError } from "../errors";

/**
 * Adapter that wraps the existing `invokeClaude()` function.
 *
 * All existing behaviour is preserved — Claude CLI subprocess spawning,
 * startup lock, auth error detection, streaming, MCP config, etc.
 *
 * Claude-specific options (like `claudePath`) are passed via the constructor
 * rather than through `AdapterInvokeOptions`.
 */
export class ClaudeAdapter implements AgentAdapter {
  readonly providerId = "claude";
  readonly modelId: string;
  readonly capabilities: AdapterCapabilities = {
    streaming: true,
    vision: true,
    structuredOutput: true,
  };

  private readonly claudePath: string;

  constructor(modelId = "claude-sonnet-4-5", claudePath = "claude") {
    this.modelId = modelId;
    this.claudePath = claudePath;
  }

  async invoke(
    workDir: string,
    prompt: string,
    options: AdapterInvokeOptions = {},
  ): Promise<AdapterResult> {
    let raw;
    try {
      raw = await invokeClaude(workDir, prompt, {
        claudePath: this.claudePath,
        systemPrompt: options.systemPrompt,
        model: options.model,
        mcpConfigPath: options.mcpConfigPath,
        onEvent: options.onEvent,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        throw new ProviderAuthError(this.providerId, err.message);
      }
      if (err instanceof RateLimitError) {
        throw new ProviderRateLimitError(this.providerId, err.message);
      }
      throw err;
    }

    return {
      exitCode: raw.exitCode,
      result: raw.result,
      usage: raw.usage
        ? {
            inputTokens: raw.usage.input_tokens,
            outputTokens: raw.usage.output_tokens,
            cacheReadTokens: raw.usage.cache_read_input_tokens,
            cacheWriteTokens: raw.usage.cache_creation_input_tokens,
          }
        : undefined,
    };
  }
}
