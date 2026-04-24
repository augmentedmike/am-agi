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
  /**
   * Path to the Claude executable. Only meaningful for `ClaudeAdapter`.
   * Preserved here so `runIteration(options)` can pass `claudePath` through
   * without breaking existing callers.
   */
  claudePath?: string;
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
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
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
 * Agent settings from the board settings DB.
 * Passed into adapter resolution to allow settings-driven agent selection.
 */
export interface AgentSettings {
  agent_provider?: string;
  agent_model_claude?: string;
  agent_model_hermes?: string;
  hermes_base_url?: string;
  hermes_api_key?: string;
  extra_usage_fallback?: string;
}

/**
 * Factory: read `<workDir>/am.project.json` and return the appropriate adapter.
 *
 * Resolution order:
 *  1. Per-worktree `am.project.json` (highest priority)
 *  2. Board settings (AgentSettings object)
 *  3. Environment variables (AM_PROVIDER, AM_BASE_URL, AM_API_KEY, AM_MODEL)
 *  4. Default → ClaudeAdapter
 *
 * Malformed JSON is silently ignored and falls through to the next tier.
 *
 * @param workDir   Absolute path to the project/worktree root.
 * @param env       Process environment (defaults to `process.env`).
 * @param settings  Optional board settings for agent selection.
 */
export function queryAdapter(
  workDir: string,
  env: NodeJS.ProcessEnv = process.env,
  settings?: AgentSettings,
): AgentAdapter {
  const configPath = join(workDir, "am.project.json");

  // Tier 1: per-worktree am.project.json
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf8");
      const parsed = JSON.parse(raw) as ProjectAdapterConfig;
      const adapterCfg = parsed.adapter;

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
      // Malformed JSON or read error — fall through
    }
  }

  // Tier 2: board settings
  if (settings) {
    return resolveAdapter(env, settings);
  }

  // Tier 3 & 4: env vars → default
  return resolveAdapter(env);
}

/**
 * Factory: choose the right adapter based on settings, then environment variables.
 *
 * Resolution:
 *  1. If `settings` is provided and `agent_provider` is set, use settings to build the adapter.
 *  2. If `AM_PROVIDER`, `AM_BASE_URL`, `AM_API_KEY` env vars are all set, use them.
 *  3. Default → `ClaudeAdapter` with default model.
 *
 * @param env       Process environment (defaults to `process.env`)
 * @param settings  Optional board settings for agent selection
 */
export function resolveAdapter(
  env: NodeJS.ProcessEnv = process.env,
  settings?: AgentSettings,
): AgentAdapter {
  // Settings-driven resolution
  if (settings?.agent_provider) {
    if (settings.agent_provider === "hermes") {
      return buildHermesAdapter(settings);
    }
    // provider is "claude" or unrecognized → ClaudeAdapter with configured model
    const { ClaudeAdapter } = require("./adapters/claude") as typeof import("./adapters/claude");
    return new ClaudeAdapter(settings.agent_model_claude ?? "claude-sonnet-4-5");
  }

  // Env-var resolution
  const provider = env.AM_PROVIDER;
  const baseURL = env.AM_BASE_URL;
  const apiKey = env.AM_API_KEY;

  if (provider && baseURL && apiKey) {
    const { OpenAICompatibleAdapter } = require("./adapters/openai-compatible") as typeof import("./adapters/openai-compatible");
    const modelId = env.AM_MODEL ?? "gpt-4o";
    return new OpenAICompatibleAdapter({ baseURL, apiKey, providerId: provider, modelId });
  }

  const { ClaudeAdapter } = require("./adapters/claude") as typeof import("./adapters/claude");
  return new ClaudeAdapter();
}

/**
 * Build a Hermes adapter from board settings.
 * Hermes is a named preset of the OpenAICompatibleAdapter pointing to a local
 * Qwen3 endpoint (LM Studio, Ollama, MLX, etc.).
 */
function buildHermesAdapter(settings: AgentSettings): AgentAdapter {
  const { OpenAICompatibleAdapter } = require("./adapters/openai-compatible") as typeof import("./adapters/openai-compatible");
  return new OpenAICompatibleAdapter({
    baseURL: settings.hermes_base_url ?? "http://localhost:1234/v1",
    apiKey: settings.hermes_api_key ?? "lm-studio",
    providerId: "hermes",
    modelId: settings.agent_model_hermes ?? "qwen3-coder-30b-a3b",
  });
}

/**
 * Build the fallback adapter for use when Claude is rate-limited.
 * Always constructs a Hermes (OpenAI-compatible) adapter from settings,
 * regardless of what `agent_provider` is set to.
 *
 * @param settings  Board agent settings
 */
export function buildFallbackAdapter(settings: AgentSettings): AgentAdapter {
  return buildHermesAdapter(settings);
}
