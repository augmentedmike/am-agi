export type CredentialField = {
  key: string;
  label: string;
  hint: string;
  url?: string;
  required: boolean;
  type: 'secret' | 'text';
};

export type WorkTypeAdapter = {
  id: string;
  label: string;
  icon: string;
  fields: CredentialField[];
};

export const ADAPTERS: WorkTypeAdapter[] = [
  {
    id: 'web-dev',
    label: 'Web Development',
    icon: '🌐',
    fields: [
      {
        key: 'GITHUB_TOKEN',
        label: 'GitHub Token',
        hint: 'Personal access token for GitHub API and repo operations.',
        url: 'https://github.com/settings/tokens',
        required: true,
        type: 'secret',
      },
      {
        key: 'VERCEL_TOKEN',
        label: 'Vercel Token',
        hint: 'API token for deploying and managing Vercel projects.',
        url: 'https://vercel.com/account/tokens',
        required: false,
        type: 'secret',
      },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    icon: '🔍',
    fields: [
      {
        key: 'TAVILY_API_KEY',
        label: 'Tavily API Key',
        hint: 'API key for Tavily web search (1,000 searches/month free).',
        url: 'https://app.tavily.com',
        required: false,
        type: 'secret',
      },
      {
        key: 'EXA_API_KEY',
        label: 'Exa API Key',
        hint: 'API key for Exa neural search (1,000 searches/month free).',
        url: 'https://exa.ai',
        required: false,
        type: 'secret',
      },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: '🤝',
    fields: [
      {
        key: 'HUBSPOT_API_KEY',
        label: 'HubSpot API Key',
        hint: 'Private app access token for HubSpot CRM API.',
        url: 'https://app.hubspot.com/api-key',
        required: true,
        type: 'secret',
      },
    ],
  },
  {
    id: 'data',
    label: 'Data & Analytics',
    icon: '📊',
    fields: [
      {
        key: 'OPENAI_API_KEY',
        label: 'OpenAI API Key',
        hint: 'API key for OpenAI models (GPT-4, embeddings, etc.).',
        url: 'https://platform.openai.com/api-keys',
        required: false,
        type: 'secret',
      },
      {
        key: 'ANTHROPIC_API_KEY',
        label: 'Anthropic API Key',
        hint: 'API key for Claude models.',
        url: 'https://console.anthropic.com/settings/keys',
        required: false,
        type: 'secret',
      },
    ],
  },
  {
    id: 'design',
    label: 'Design',
    icon: '🎨',
    fields: [],
  },
  {
    id: 'devops',
    label: 'DevOps',
    icon: '⚙️',
    fields: [
      {
        key: 'FLY_API_TOKEN',
        label: 'Fly.io API Token',
        hint: 'Authentication token for deploying apps on Fly.io.',
        url: 'https://fly.io/user/personal_access_tokens',
        required: false,
        type: 'secret',
      },
      {
        key: 'CLOUDFLARE_API_TOKEN',
        label: 'Cloudflare API Token',
        hint: 'API token for managing Cloudflare DNS, Workers, and Pages.',
        url: 'https://dash.cloudflare.com/profile/api-tokens',
        required: false,
        type: 'secret',
      },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: '✍️',
    fields: [
      {
        key: 'OPENAI_API_KEY',
        label: 'OpenAI API Key',
        hint: 'API key for AI-assisted content generation.',
        url: 'https://platform.openai.com/api-keys',
        required: false,
        type: 'secret',
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: '💰',
    fields: [],
  },
];
