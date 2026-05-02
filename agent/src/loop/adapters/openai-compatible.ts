import type { AgentAdapter, AdapterInvokeOptions, AdapterResult, AdapterCapabilities, StreamChunk } from "../adapter";
import { ProviderAuthError, ProviderRateLimitError, ProviderTimeoutError } from "../errors";

type ChatMessage = { role: "system" | "user"; content: string };
type ChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
};
type ChatResponse = {
  choices: { message?: { content?: string | null } }[];
  usage?: ChatUsage;
};
type ChatStreamChunk = {
  choices?: { delta?: { content?: string } }[];
  usage?: ChatUsage;
};

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
  readonly capabilities: AdapterCapabilities = {
    streaming: true,
    vision: false,
    structuredOutput: true,
  };
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

    const messages: ChatMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const streaming = !!options.onEvent;

    try {
      if (streaming) {
        return await this.invokeStreaming(client, model, messages, options);
      }

      const requestBody: Record<string, unknown> = { model, messages };
      if (options.responseFormat === "json") {
        requestBody.response_format = { type: "json_object" };
      }

      const response = await client.chat.completions.create(
        requestBody as unknown as Parameters<typeof client.chat.completions.create>[0],
      ) as unknown as ChatResponse;

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
              cacheReadTokens: usage.prompt_cache_hit_tokens ?? 0,
              cacheWriteTokens: usage.prompt_cache_miss_tokens ?? 0,
            }
          : undefined,
      };
    } catch (err: unknown) {
      this.handleError(err);
    }
  }

  private async invokeStreaming(
    client: InstanceType<typeof import("openai").default>,
    model: string,
    messages: ChatMessage[],
    options: AdapterInvokeOptions,
  ): Promise<AdapterResult> {
    const requestBody: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (options.responseFormat === "json") {
      requestBody.response_format = { type: "json_object" };
    }

    const stream = await client.chat.completions.create(
      requestBody as unknown as Parameters<typeof client.chat.completions.create>[0],
    ) as unknown as AsyncIterable<ChatStreamChunk>;

    let result = "";
    let finalUsage: AdapterResult["usage"] | undefined;

    for await (const chunk of stream) {
      const choices = chunk.choices;
      const delta = choices?.[0]?.delta?.content;
      if (delta) {
        result += delta;
        const streamChunk: StreamChunk = { type: "text_delta", text: delta };
        options.onEvent!(streamChunk as unknown as import("../invoke-claude").StreamEvent);
      }

      const usage = chunk.usage;
      if (usage) {
        finalUsage = {
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
          cacheReadTokens: usage.prompt_cache_hit_tokens ?? 0,
          cacheWriteTokens: usage.prompt_cache_miss_tokens ?? 0,
        };
        const usageChunk: StreamChunk = { type: "usage", usage: finalUsage };
        options.onEvent!(usageChunk as unknown as import("../invoke-claude").StreamEvent);
      }
    }

    return { exitCode: 0, result, usage: finalUsage };
  }

  /**
   * Translate OpenAI SDK errors into provider-agnostic error types.
   * Always throws — return type `never` tells TS the caller path ends here.
   */
  private handleError(err: unknown): never {
    if (err && typeof err === "object") {
      const status = (err as { status?: number }).status;
      const code = (err as { code?: string }).code;

      if (status === 401 || status === 403) {
        throw new ProviderAuthError(this.providerId, (err as Error).message);
      }
      if (status === 429) {
        throw new ProviderRateLimitError(this.providerId, (err as Error).message);
      }
      if (code === "ETIMEDOUT" || code === "ECONNABORTED" || code === "UND_ERR_CONNECT_TIMEOUT") {
        throw new ProviderTimeoutError(this.providerId, (err as Error).message);
      }
      // OpenAI SDK APIConnectionTimeoutError
      if ((err as { constructor?: { name?: string } }).constructor?.name === "APIConnectionTimeoutError") {
        throw new ProviderTimeoutError(this.providerId, (err as Error).message);
      }
    }
    throw err;
  }
}
