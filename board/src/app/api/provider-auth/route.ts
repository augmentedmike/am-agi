import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getAllSettings, setSetting } from '@/db/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = 'codex' | 'deepseek' | 'qwen' | 'hermes' | 'local';

interface ProviderMeta {
  provider: Provider;
  label: string;
  modelKey: string;
  keyKey?: string;
  baseUrlKey?: string;
  defaultModel: string;
  defaultBaseUrl?: string;
  keyEnv: string[];
  keyRequired: boolean;
}

const PROVIDERS: ProviderMeta[] = [
  {
    provider: 'codex',
    label: 'OpenAI - Codex',
    modelKey: 'agent_model_codex',
    keyKey: 'codex_api_key',
    baseUrlKey: 'codex_base_url',
    defaultModel: 'gpt-5.1-codex',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyEnv: ['OPENAI_API_KEY', 'AM_OPENAI_API_KEY'],
    keyRequired: true,
  },
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    modelKey: 'agent_model_deepseek',
    keyKey: 'deepseek_api_key',
    baseUrlKey: 'deepseek_base_url',
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    keyEnv: ['DEEPSEEK_API_KEY', 'AM_DEEPSEEK_API_KEY'],
    keyRequired: true,
  },
  {
    provider: 'qwen',
    label: 'Qwen',
    modelKey: 'agent_model_qwen',
    keyKey: 'qwen_api_key',
    baseUrlKey: 'qwen_base_url',
    defaultModel: 'qwen3-coder-plus',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    keyEnv: ['DASHSCOPE_API_KEY', 'QWEN_API_KEY', 'AM_QWEN_API_KEY'],
    keyRequired: true,
  },
  {
    provider: 'hermes',
    label: 'Hermes / Local',
    modelKey: 'agent_model_hermes',
    keyKey: 'hermes_api_key',
    baseUrlKey: 'hermes_base_url',
    defaultModel: 'qwen3-coder-30b-a3b',
    defaultBaseUrl: 'http://localhost:1234/v1',
    keyEnv: ['AM_HERMES_API_KEY'],
    keyRequired: false,
  },
  {
    provider: 'local',
    label: 'Local OpenAI-compatible',
    modelKey: 'agent_model_hermes',
    keyKey: 'hermes_api_key',
    baseUrlKey: 'hermes_base_url',
    defaultModel: 'qwen3-coder-30b-a3b',
    defaultBaseUrl: 'http://localhost:1234/v1',
    keyEnv: ['AM_LOCAL_API_KEY'],
    keyRequired: false,
  },
];

function providerMeta(provider: string | undefined): ProviderMeta {
  return PROVIDERS.find(p => p.provider === provider) ?? PROVIDERS[0];
}

function envKey(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
}

function publicState(settings: Record<string, string>) {
  const meta = providerMeta(settings.agent_provider);
  const storedKey = meta.keyKey ? settings[meta.keyKey] ?? '' : '';
  const configuredByEnv = !!envKey(meta.keyEnv);
  const authenticated = !meta.keyRequired || !!storedKey || configuredByEnv;

  return {
    authenticated,
    configuredByEnv,
    provider: meta.provider,
    providers: PROVIDERS.map(p => ({
      provider: p.provider,
      label: p.label,
      defaultModel: p.defaultModel,
      defaultBaseUrl: p.defaultBaseUrl,
      keyRequired: p.keyRequired,
      keyEnv: p.keyEnv,
    })),
    model: settings[meta.modelKey] || meta.defaultModel,
    baseUrl: meta.baseUrlKey ? settings[meta.baseUrlKey] || meta.defaultBaseUrl || '' : '',
    keyRequired: meta.keyRequired,
    keyEnv: meta.keyEnv,
    hasKey: !!storedKey || configuredByEnv,
  };
}

export async function GET() {
  const { db } = getDb();
  return NextResponse.json(publicState(getAllSettings(db)));
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      provider?: string;
      model?: string;
      baseUrl?: string;
      apiKey?: string;
    };
    const meta = providerMeta(body.provider);
    const { db } = getDb();

    setSetting(db, 'agent_provider', meta.provider);
    if (body.model?.trim()) {
      setSetting(db, meta.modelKey, body.model.trim());
    }
    if (meta.baseUrlKey && body.baseUrl?.trim()) {
      setSetting(db, meta.baseUrlKey, body.baseUrl.trim());
    }
    if (meta.keyKey && body.apiKey?.trim() && body.apiKey.trim() !== '***') {
      setSetting(db, meta.keyKey, body.apiKey.trim());
    }

    const settings = getAllSettings(db);
    return NextResponse.json(publicState(settings));
  } catch {
    return NextResponse.json(
      { authenticated: false, error: 'Invalid provider setup request' },
      { status: 400 },
    );
  }
}
