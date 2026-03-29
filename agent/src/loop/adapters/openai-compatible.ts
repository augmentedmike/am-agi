import type { AgentAdapter, AdapterInvokeOptions, AdapterResult } from "../adapter";

export interface OpenAICompatibleAdapterOptions {
  /** Base URL for the OpenAI-compatible API, e.g. "https://api.deepseek.com/v1". */
  baseURL: string;
  /** API key for the provider. */
  apiKey: string;
  /** Stable provider ID, e.g. "deepseek", "qwen", "kimi". */
  providerId: string;
  /** Default model ID for this provider, e.g. "deepseek-chat". */
  modelId: string;
}

/**
 * Adapter for any OpenAI-compatible API endpoint.
 *
 * Covers DeepSeek, Qwen, Kimi K2, and any vLLM-hosted model — all expose
 * the `/v1/chat/completions` endpoint with the same wire format. The only
 * differences are `baseURL`, `apiKey`, and `model`.
 *
 * Uses the `openai` npm package as the HTTP client. The package must be
 * installed in the agent workspace (`bun add openai`).
 */
export class OpenAICompatibleAdapter implements AgentAdapter {
  readonly providerId: string;
  readonly modelId: string;
  private readonly baseURL: string;
  private readonly apiKey: string;

  constructor(options: OpenAICompatibleAdapterOptions) {
    this.baseURL = options.baseURL;
    this.apiKey = options.apiKey;
    this.providerId = options.providerId;
    this.modelId = options.modelId;
  }

  async invoke(
    _workDir: string,
    prompt: string,
    options: AdapterInvokeOptions = {},
  ): Promise<AdapterResult> {
    // Lazy import — keeps startup fast when only ClaudeAdapter is used.
    const { default: OpenAI } = await import("openai");

    const client = new OpenAI({ baseURL: this.baseURL, apiKey: this.apiKey });

    const model = options.model ?? this.modelId;

    const messages: { role: "system" | "user"; content: string }[] = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({ model, messages });

    const choice = response.choices[0];
    const result = choice?.message?.content ?? "";
    const usage = response.usage;

    return {
      exitCode: 0,
      result,
      usage: usage
        ? {
            inputTokens: usage.prompt_tokens ?? 0,
            outputTokens: usage.completion_tokens ?? 0,
            cacheReadTokens: (usage as Record<string, unknown>).prompt_cache_hit_tokens as number ?? 0,
            cacheWriteTokens: (usage as Record<string, unknown>).prompt_cache_miss_tokens as number ?? 0,
          }
        : undefined,
    };
  }
}
