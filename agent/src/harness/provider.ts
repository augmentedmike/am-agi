export type AmProviderId = "codex" | "openai" | "deepseek" | "qwen" | "openrouter" | "local";

export interface ProviderConfigInput {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ProviderConfig {
  provider: AmProviderId;
  model: string;
  baseUrl: string;
  apiKey: string;
}

interface ProviderDefaults {
  model: string;
  baseUrl: string;
  apiKeyEnv: string[];
}

const DEFAULTS: Record<AmProviderId, ProviderDefaults> = {
  codex: {
    model: "gpt-5.1-codex",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: ["OPENAI_API_KEY", "AM_OPENAI_API_KEY"],
  },
  openai: {
    model: "gpt-5.1",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: ["OPENAI_API_KEY", "AM_OPENAI_API_KEY"],
  },
  deepseek: {
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: ["DEEPSEEK_API_KEY", "AM_DEEPSEEK_API_KEY"],
  },
  qwen: {
    model: "qwen3-coder-plus",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyEnv: ["DASHSCOPE_API_KEY", "QWEN_API_KEY", "AM_QWEN_API_KEY"],
  },
  openrouter: {
    model: "qwen/qwen3-coder",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: ["OPENROUTER_API_KEY", "AM_OPENROUTER_API_KEY"],
  },
  local: {
    model: "qwen3-coder-30b-a3b",
    baseUrl: "http://localhost:1234/v1",
    apiKeyEnv: ["AM_LOCAL_API_KEY"],
  },
};

export function normalizeProvider(provider: string | undefined): AmProviderId {
  const value = (provider ?? "codex").toLowerCase();
  if (
    value === "codex"
    || value === "openai"
    || value === "deepseek"
    || value === "qwen"
    || value === "openrouter"
    || value === "local"
  ) {
    return value;
  }
  throw new Error(`unknown provider: ${provider}`);
}

export function resolveProviderConfig(input: ProviderConfigInput = {}): ProviderConfig {
  const env = input.env ?? process.env;
  const provider = normalizeProvider(input.provider ?? env.AM_PROVIDER);
  const defaults = DEFAULTS[provider];
  const apiKeyEnvNames = input.apiKeyEnv ? [input.apiKeyEnv] : defaults.apiKeyEnv;
  const apiKey = input.apiKey
    ?? firstEnv(env, apiKeyEnvNames)
    ?? (provider === "local" ? "not-needed" : "");

  if (!apiKey) {
    throw new Error(
      `missing API key for ${provider}; set one of ${apiKeyEnvNames.join(", ")} or pass --api-key-env`,
    );
  }

  return {
    provider,
    model: input.model ?? env.AM_MODEL ?? defaults.model,
    baseUrl: stripTrailingSlash(input.baseUrl ?? env.AM_BASE_URL ?? defaults.baseUrl),
    apiKey,
  };
}

function firstEnv(env: NodeJS.ProcessEnv, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value) return value;
  }
  return undefined;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
