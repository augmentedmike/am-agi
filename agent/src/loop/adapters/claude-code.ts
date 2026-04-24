import { AuthError, RateLimitError } from "../invoke-claude";
import type { AgentAdapter, AdapterInvokeOptions, AdapterResult } from "../adapter";
import type { StreamEvent } from "../invoke-claude";
import { readFileSync } from "node:fs";

/**
 * Adapter that uses the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
 * instead of spawning a CLI subprocess.
 *
 * Benefits over the CLI-based ClaudeAdapter:
 * - No subprocess spawn overhead or startup lock
 * - No PATH resolution or env-stripping workarounds
 * - Typed message stream with structured result/usage
 * - Native MCP server support (no temp config file)
 */
export class ClaudeCodeAdapter implements AgentAdapter {
  readonly providerId = "claude-code";
  readonly modelId: string;

  constructor(modelId = "claude-sonnet-4-5") {
    this.modelId = modelId;
  }

  async invoke(
    workDir: string,
    prompt: string,
    options: AdapterInvokeOptions = {},
  ): Promise<AdapterResult> {
    // Lazy import — keeps startup fast when this adapter is not used.
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    // Build SDK options
    const model = options.model ?? this.modelId;

    const sdkOptions: Record<string, unknown> = {
      cwd: workDir,
      model,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      // Don't persist sessions — agent loop is ephemeral per iteration
      persistSession: false,
    };

    if (options.systemPrompt) {
      sdkOptions.systemPrompt = options.systemPrompt;
    }

    // Parse MCP config file and pass servers directly to the SDK
    if (options.mcpConfigPath) {
      try {
        const raw = readFileSync(options.mcpConfigPath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
          sdkOptions.mcpServers = parsed.mcpServers;
        }
      } catch {
        // MCP config parse failure — continue without MCP servers
      }
    }

    // Iterate the async generator, collecting the result
    let resultText = "";
    let exitCode = 0;
    let usage: AdapterResult["usage"] | undefined;

    try {
      for await (const message of query({ prompt, options: sdkOptions as any })) {
        // Forward events to onEvent callback
        if (options.onEvent) {
          const translated = translateToStreamEvent(message);
          if (translated) {
            options.onEvent(translated);
          }
        }

        // Handle rate limit events
        if (message.type === "rate_limit_event") {
          const info = (message as any).rate_limit_info;
          if (info?.status === "rejected") {
            const resetAt = info.resetsAt
              ? new Date(info.resetsAt * 1000)
              : new Date(Date.now() + 3_600_000);
            throw new RateLimitError(resetAt);
          }
        }

        // Handle auth status events
        if (message.type === "auth_status") {
          const authMsg = message as any;
          if (authMsg.error) {
            throw new AuthError("Claude auth expired — run /login to restore");
          }
        }

        // Extract final result
        if (message.type === "result") {
          const resultMsg = message as any;

          if (resultMsg.subtype === "success") {
            resultText = resultMsg.result ?? "";
            exitCode = 0;
          } else {
            // error_during_execution, error_max_turns, etc.
            resultText = resultMsg.errors?.join("\n") ?? "";
            exitCode = 1;
          }

          // Extract usage from result message
          if (resultMsg.usage) {
            usage = {
              inputTokens: resultMsg.usage.input_tokens ?? 0,
              outputTokens: resultMsg.usage.output_tokens ?? 0,
              cacheReadTokens: resultMsg.usage.cache_read_input_tokens ?? 0,
              cacheWriteTokens: resultMsg.usage.cache_creation_input_tokens ?? 0,
            };
          }
        }
      }
    } catch (err) {
      // Re-throw our own error types
      if (err instanceof RateLimitError || err instanceof AuthError) {
        throw err;
      }

      // Check if the error message contains auth-related patterns
      const errMsg = String(err);
      const authPatterns = [
        "not logged in",
        "authentication",
        "unauthorized",
        "401",
        "token expired",
        "oauth",
        "invalid api key",
        "credentials",
      ];
      if (authPatterns.some((p) => errMsg.toLowerCase().includes(p))) {
        throw new AuthError("Claude auth expired — run /login to restore");
      }

      // Generic error — return non-zero exit code
      return {
        exitCode: 1,
        result: errMsg,
        usage: undefined,
      };
    }

    return { exitCode, result: resultText, usage };
  }
}

/**
 * Translate an SDK message to the StreamEvent format used by invoke-claude.ts,
 * so callers see a consistent interface regardless of adapter.
 */
function translateToStreamEvent(message: any): StreamEvent | null {
  switch (message.type) {
    case "assistant":
      return {
        type: "assistant",
        message: {
          role: "assistant",
          content: message.message?.content,
        },
      };

    case "result":
      return {
        type: "result",
        result: message.subtype === "success" ? message.result : undefined,
        usage: message.usage
          ? {
              input_tokens: message.usage.input_tokens,
              output_tokens: message.usage.output_tokens,
              cache_read_input_tokens: message.usage.cache_read_input_tokens,
              cache_creation_input_tokens: message.usage.cache_creation_input_tokens,
            }
          : undefined,
      };

    case "system":
      return {
        type: "system",
        subtype: message.subtype,
      };

    default:
      return null;
  }
}
