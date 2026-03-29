import { invokeClaude } from "../invoke-claude";
import type { AgentAdapter, AdapterInvokeOptions, AdapterResult } from "../adapter";

/**
 * Adapter that wraps the existing `invokeClaude()` function.
 *
 * All existing behaviour is preserved — Claude CLI subprocess spawning,
 * startup lock, auth error detection, streaming, MCP config, etc.
 */
export class ClaudeAdapter implements AgentAdapter {
  readonly providerId = "claude";
  readonly modelId: string;

  constructor(modelId = "claude-sonnet-4-5") {
    this.modelId = modelId;
  }

  async invoke(
    workDir: string,
    prompt: string,
    options: AdapterInvokeOptions = {},
  ): Promise<AdapterResult> {
    const raw = await invokeClaude(workDir, prompt, {
      claudePath: options.claudePath,
      systemPrompt: options.systemPrompt,
      model: options.model,
      mcpConfigPath: options.mcpConfigPath,
      onEvent: options.onEvent,
    });

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
