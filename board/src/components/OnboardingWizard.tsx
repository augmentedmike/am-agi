'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useChat } from '@/contexts/ChatContext';

// ── Step 1 — Welcome from AM ──────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex flex-col items-center text-center gap-7 w-full max-w-sm mx-auto">
      {/* AM avatar */}
      <div
        className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0"
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {!imgError ? (
          <img
            src="/am-avatar.png"
            alt="AM"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-xl font-semibold text-white"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            AM
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          Hi, I&apos;m AM
        </h1>
        <p className="text-white/50 text-sm font-light leading-relaxed">
          I&apos;m your autonomous digital worker — I remember context between sessions, manage my own tasks, and ship real work. Let&apos;s get you set up.
        </p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
        style={{ background: 'rgb(236,72,153)', color: '#fff' }}
      >
        Let&apos;s go
      </button>
    </div>
  );
}

// ── Step 2 — Connect Provider ────────────────────────────────────────────────

function Step2({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [checking, setChecking] = useState(false);
  const [provider, setProvider] = useState<string>('codex');
  const [model, setModel] = useState('gpt-5.1-codex');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [providers, setProviders] = useState<Array<{
    provider: string;
    label: string;
    defaultModel: string;
    defaultBaseUrl?: string;
    keyRequired: boolean;
    keyEnv: string[];
  }>>([]);
  const [keyRequired, setKeyRequired] = useState(true);
  const [keyEnv, setKeyEnv] = useState<string[]>(['OPENAI_API_KEY']);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const applyProviderState = (data: {
    provider?: string;
    providers?: Array<{
      provider: string;
      label: string;
      defaultModel: string;
      defaultBaseUrl?: string;
      keyRequired: boolean;
      keyEnv: string[];
    }>;
    model?: string;
    baseUrl?: string;
    keyRequired?: boolean;
    keyEnv?: string[];
    authenticated?: boolean;
  }) => {
    const nextProviders = data.providers ?? providers;
    if (data.providers) setProviders(data.providers);
    const nextProvider = data.provider ?? provider;
    const meta = nextProviders.find(p => p.provider === nextProvider);
    setProvider(nextProvider);
    setModel(data.model ?? meta?.defaultModel ?? model);
    setBaseUrl(data.baseUrl ?? meta?.defaultBaseUrl ?? baseUrl);
    setKeyRequired(data.keyRequired ?? meta?.keyRequired ?? true);
    setKeyEnv(data.keyEnv ?? meta?.keyEnv ?? []);
    setStatus(data.authenticated ? 'connected' : 'disconnected');
  };

  const check = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/provider-auth');
      const data = await res.json();
      applyProviderState(data);
    } catch {
      setStatus('disconnected');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProvider = providers.find(p => p.provider === provider);
  const providerLabel = selectedProvider?.label ?? 'OpenAI - Codex';

  const handleSaveApiKey = async () => {
    if (keyRequired && !apiKey.trim()) return;
    setApiKeyError(null);
    setChecking(true);
    try {
      const res = await fetch('/api/provider-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
        }),
      });
      const data = await res.json();
      if (data.authenticated) {
        applyProviderState(data);
        setStatus('connected');
        setTimeout(onNext, 800);
      } else {
        setApiKeyError(data.error ?? 'Could not verify API key');
      }
    } catch {
      setApiKeyError('Network error — please try again');
    } finally {
      setChecking(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    outline: 'none',
  };

  return (
    <div className="flex flex-col items-center text-center gap-7 w-full max-w-sm mx-auto">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white tracking-tight">Connect a model</h2>
        <p className="text-white/50 text-sm font-light leading-relaxed">
          Choose the provider AM should use and add the model/API key for this install.
        </p>
      </div>

      {/* Status indicator */}
      <div
        className="w-full rounded-2xl px-5 py-4 flex items-center gap-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: status === 'connected'
              ? 'rgba(74,222,128,0.9)'
              : status === 'disconnected'
              ? 'rgba(248,113,113,0.7)'
              : 'rgba(255,255,255,0.3)',
            boxShadow: status === 'connected' ? '0 0 8px rgba(74,222,128,0.4)' : 'none',
          }}
        />
        <span className="text-sm text-white/70">
          {status === 'checking' ? 'Checking connection…' : status === 'connected' ? 'Connected — continuing…' : 'Not connected'}
        </span>
      </div>

      {status === 'disconnected' && (
        <div className="w-full flex flex-col gap-2">
          <select
            value={provider}
            onChange={e => {
              const next = providers.find(p => p.provider === e.target.value);
              setProvider(e.target.value);
              setModel(next?.defaultModel ?? '');
              setBaseUrl(next?.defaultBaseUrl ?? '');
              setKeyRequired(next?.keyRequired ?? true);
              setKeyEnv(next?.keyEnv ?? []);
              setApiKey('');
              setApiKeyError(null);
            }}
            className="w-full rounded-xl px-4 py-3 text-sm focus:ring-0"
            style={inputStyle}
          >
            {providers.map(p => <option key={p.provider} value={p.provider}>{p.label}</option>)}
          </select>
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="Model"
            className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/25 focus:ring-0"
            style={inputStyle}
          />
          {baseUrl && (
            <input
              type="url"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="Base URL"
              className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/25 focus:ring-0"
              style={inputStyle}
            />
          )}
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={keyRequired ? 'API key' : 'API key (optional)'}
            className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/25 focus:ring-0"
            style={inputStyle}
          />
          {apiKeyError && <p className="text-red-400/70 text-xs px-1">{apiKeyError}</p>}
          <button
            onClick={handleSaveApiKey}
            disabled={(keyRequired && !apiKey.trim()) || !model.trim() || checking}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
            style={(keyRequired && !apiKey.trim()) || !model.trim() || checking ? {
              background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.25)',
              cursor: 'not-allowed',
            } : {
              background: 'rgb(236,72,153)',
              color: '#fff',
            }}
          >
            {checking ? 'Saving…' : 'Save model settings'}
          </button>
          <p className="text-white/30 text-xs">
            {keyRequired
              ? <>Or set <code className="text-white/50">{keyEnv[0] ?? 'API_KEY'}</code> in your environment and restart.</>
              : `${providerLabel} can run without a hosted API key if your local server is running.`}
          </p>
        </div>
      )}

      {status === 'connected' && (
        <button
          onClick={onNext}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{ background: 'rgb(236,72,153)', color: '#fff' }}
        >
          Continue
        </button>
      )}
    </div>
  );
}

// ── Step 3 — Create project ───────────────────────────────────────────────────

const CATEGORY_MAP: { label: string; templates: { type: string; name: string }[] }[] = [
  { label: 'Software', templates: [{ type: 'software',          name: 'Software' }] },
];

function Step3({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('');
  const [workBranch, setWorkBranch] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = CATEGORY_MAP.find(c => c.label === selectedCategory);
  const hasSubs = category && category.templates.length > 1;
  const isSoftware = selectedCategory === 'Software';

  const handleCategorySelect = (label: string) => {
    setSelectedCategory(label);
    const cat = CATEGORY_MAP.find(c => c.label === label);
    if (cat) setSelectedTemplate(cat.templates[0].type);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, string> = { name: name.trim(), templateType: selectedTemplate };
      if (isSoftware && githubUrl.trim()) payload.githubRepo = githubUrl.trim();
      if (isSoftware && workBranch.trim()) payload.defaultBranch = workBranch.trim();
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) { onNext(); }
      else { const d = await res.json(); setError(d.error ?? 'Failed to create project'); }
    } catch { setError('Network error — please try again'); }
    finally { setLoading(false); }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    outline: 'none',
  };

  const isDisabled = !name.trim() || !selectedCategory || loading;

  return (
    <div className="flex flex-col gap-5 w-full max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white tracking-tight">Create your first project</h2>
        <p className="text-white/40 text-sm mt-1 font-light">Pick a template to get started fast.</p>
      </div>

      {/* Category grid */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_MAP.map(cat => (
          <button
            key={cat.label}
            type="button"
            onClick={() => handleCategorySelect(cat.label)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
            style={selectedCategory === cat.label ? {
              background: 'rgba(236,72,153,0.15)',
              border: '1px solid rgba(236,72,153,0.5)',
              color: 'rgb(249,168,212)',
            } : {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sub-template picker (only for categories with multiple templates) */}
      {hasSubs && (
        <div className="flex gap-1.5">
          {category.templates.map(t => (
            <button
              key={t.type}
              type="button"
              onClick={() => setSelectedTemplate(t.type)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-150"
              style={selectedTemplate === t.type ? {
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
              } : {
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Project name"
          required
          className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/25 focus:ring-0"
          style={inputStyle}
        />

        {isSoftware && (
          <>
            <input
              type="text"
              value={workBranch}
              onChange={e => setWorkBranch(e.target.value)}
              placeholder="Work branch (e.g. dev)"
              className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/25 focus:ring-0"
              style={inputStyle}
            />
            <input
              type="url"
              value={githubUrl}
              onChange={e => setGithubUrl(e.target.value)}
              placeholder="GitHub URL (e.g. https://github.com/you/repo)"
              className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/25 focus:ring-0"
              style={inputStyle}
            />
          </>
        )}

        {error && <p className="text-red-400/70 text-xs px-1">{error}</p>}

        <button
          type="submit"
          disabled={isDisabled}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 mt-1"
          style={isDisabled ? {
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.25)',
            cursor: 'not-allowed',
          } : {
            background: 'rgb(236,72,153)',
            color: '#fff',
          }}
        >
          {loading ? 'Creating…' : 'Create project'}
        </button>
      </form>

    </div>
  );
}

// ── Step 4 — Done, open chat ──────────────────────────────────────────────────

function Step4({ onComplete }: { onComplete: () => void }) {
  const { openChat } = useChat();
  const [imgError, setImgError] = useState(false);

  const handleStart = () => {
    onComplete();
    openChat();
  };

  return (
    <div className="flex flex-col items-center text-center gap-7 w-full max-w-sm mx-auto">
      <div
        className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0"
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {!imgError ? (
          <img src="/am-avatar.png" alt="AM" className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl font-semibold text-white" style={{ background: 'rgba(255,255,255,0.06)' }}>
            AM
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white tracking-tight">Ready to work</h2>
        <p className="text-white/50 text-sm font-light leading-relaxed">
          Describe what you want to build — I&apos;ll handle everything from there.
        </p>
      </div>

      <button
        onClick={handleStart}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
        style={{ background: 'rgb(236,72,153)', color: '#fff' }}
      >
        Say hello to AM →
      </button>
    </div>
  );
}

// ── Wizard Shell ──────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const { isOnboardingComplete, isCheckingOnboarding, currentStep, nextStep, completeOnboarding } = useOnboarding();

  if (isCheckingOnboarding || isOnboardingComplete) return null;

  const totalSteps = 4;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(24px) saturate(180%)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(40px)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-6 pb-0 px-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i + 1 === currentStep ? 20 : 6,
                height: 6,
                background: i + 1 <= currentStep ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-8 min-h-[360px] flex items-center justify-center">
          {currentStep === 1 && <Step1 onNext={nextStep} />}
          {currentStep === 2 && <Step2 onNext={nextStep} />}
          {currentStep === 3 && <Step3 onNext={nextStep} />}
          {currentStep === 4 && <Step4 onComplete={completeOnboarding} />}
        </div>

        {/* Step label */}
        <div className="pb-5 flex items-center justify-center">
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11 }}>
            {currentStep} of {totalSteps}
          </span>
        </div>
      </div>
    </div>
  );
}
