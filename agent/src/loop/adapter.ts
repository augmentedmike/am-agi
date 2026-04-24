import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StreamEvent } from "./invoke-claude";

/**
 * Options passed to `AgentAdapter.invoke()`.
 * Mirrors the fields from `InvokeOptions` that are provider-agnostic.
 */
export interface AdapterInvokeOptions {
  /** Optional system prompt to pass to the model. */
  systemPrompt?: string;
  /** Optional model override (overrides the adapter's default modelId). */
  model?: string;
  /** Path to an MCP config JSON file. */
  mcpConfigPath?: string;
  /** Called for each parsed stream event as they arrive. */
  onEvent?: (event: StreamEvent) => void;
  /** Request a specific response format from the model. */
  responseFormat?: "text" | "json";
}

/**
 * Token usage reported by a model provider, normalised to camelCase.
 * Extracted as a named type so it can be referenced independently.
 */
export interface AdapterUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/**
 * Result returned by `AgentAdapter.invoke()`.
 * Token field names are camelCase (provider-neutral) unlike the Claude CLI's
 * snake_case usage fields.
 */
export interface AdapterResult {
  /** Exit / status code. 0 = success. */
  exitCode: number;
  /** Text output from the model. */
  result: string;
  /** Token usage, if the provider reported it. */
  usage?: AdapterUsage;
}

/**
 * A single chunk emitted during streaming responses.
 */
export interface StreamChunk {
  type: "text_delta" | "usage";
  text?: string;
  usage?: AdapterUsage;
}

/**
 * Declares what a model provider supports so the loop can adapt behaviour.
 */
export interface AdapterCapabilities {
  streaming: boolean;
  vision: boolean;
  structuredOutput: boolean;
}

/**
 * Common interface every model adapter must implement.
 *
 * An adapter is a thin translation layer between AM's agent loop and a
 * specific model provider. The loop calls `invoke()` and gets back a
 * normalised `AdapterResult` — it never touches provider-specific details.
 */
export interface AgentAdapter {
  /** Stable identifier for the provider, e.g. "claude", "openai", "deepseek". */
  readonly providerId: string;
  /** Model identifier as understood by the provider, e.g. "claude-sonnet-4-5". */
  readonly modelId: string;
  /** What this adapter/provider supports. */
  readonly capabilities: AdapterCapabilities;
  /**
   * Invoke the model with the given prompt inside `workDir`.
   * @param workDir  Absolute path to the git worktree for this task.
   * @param prompt   The full prompt string to send.
   * @param options  Provider-agnostic invoke options.
   */
  invoke(
    workDir: string,
    prompt: string,
    options?: AdapterInvokeOptions,
  ): Promise<AdapterResult>;
}

/**
 * Shape of the optional `adapter` block inside `am.project.json`.
 */
export interface ProjectAdapterConfig {
  adapter?: {
    provider?: string;
    baseURL?: string;
    apiKey?: string;
    model?: string;
  };
}

/**
 * Factory: read `<workDir>/am.project.json` and return the appropriate adapter.
 *
 * Resolution order:
 *  1. If the file is absent or has no `adapter` block → fall back to `resolveAdapter(env)`.
 *  2. If `adapter` has `provider`, `baseURL`, and `apiKey` → return `OpenAICompatibleAdapter`.
 *  3. Otherwise (e.g. only `provider: "claude"`) → return `ClaudeAdapter`.
 *
 * Malformed JSON is silently ignored and falls back to `resolveAdapter(env)`.
 *
 * @param workDir  Absolute path to the project/worktree root.
 * @param env      Process environment (defaults to `process.env`).
 */
export function queryAdapter(
  workDir: string,
  env: NodeJS.ProcessEnv = process.env,
): AgentAdapter {
  const configPath = join(workDir, "am.project.json");

  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf8");
      const parsed = JSON.parse(raw) as ProjectAdapterConfig;
      const adapterCfg = parsed.adapter;

      if (adapterCfg && adapterCfg.provider === "claude-code") {
        const { ClaudeCodeAdapter } = require("./adapters/claude-code") as typeof import("./adapters/claude-code");
        return new ClaudeCodeAdapter(adapterCfg.model);
      }

      if (adapterCfg && adapterCfg.provider && adapterCfg.baseURL && adapterCfg.apiKey) {
        const { OpenAICompatibleAdapter } = require("./adapters/openai-compatible") as typeof import("./adapters/openai-compatible");
        return new OpenAICompatibleAdapter({
          baseURL: adapterCfg.baseURL,
          apiKey: adapterCfg.apiKey,
          providerId: adapterCfg.provider,
          modelId: adapterCfg.model ?? "gpt-4o",
        });
      }
    } catch {
      // Malformed JSON or read error — fall through to resolveAdapter
    }
  }

  return resolveAdapter(env);
}

/**
 * Factory: choose the right adapter based on environment variables.
 *
 * - Default: `ClaudeAdapter` (preserves all existing behaviour)
 * - When `AM_PROVIDER`, `AM_BASE_URL`, and `AM_API_KEY` are all set:
 *   returns an `OpenAICompatibleAdapter` configured from those vars.
 *
 * @param env  Process environment (defaults to `process.env`)
 */
export function resolveAdapter(env: NodeJS.ProcessEnv = process.env): AgentAdapter {
  const provider = env.AM_PROVIDER;
  const baseURL = env.AM_BASE_URL;
  const apiKey = env.AM_API_KEY;

  if (provider && baseURL && apiKey) {
    // Dynamic import kept synchronous-looking via a lazy require pattern —
    // adapters are small so the overhead is negligible.
    const { OpenAICompatibleAdapter } = require("./adapters/openai-compatible") as typeof import("./adapters/openai-compatible");
    const modelId = env.AM_MODEL ?? "gpt-4o";
    return new OpenAICompatibleAdapter({ baseURL, apiKey, providerId: provider, modelId });
  }

  // Use Claude Agent SDK when AM_CLAUDE_SDK=1
  if (env.AM_CLAUDE_SDK === "1") {
    const { ClaudeCodeAdapter } = require("./adapters/claude-code") as typeof import("./adapters/claude-code");
    return new ClaudeCodeAdapter(env.AM_MODEL);
  }

  const { ClaudeAdapter } = require("./adapters/claude") as typeof import("./adapters/claude");
  return new ClaudeAdapter();
}
