'use client';

import { useEffect, useState, useCallback } from 'react';
import { ADAPTERS } from '@/lib/adapters';

interface FieldRowProps {
  adapterKey: string;
  label: string;
  hint: string;
  required: boolean;
  isSecret: boolean;
  url?: string;
  isSet: boolean;
  onSaved: (key: string) => void;
}

function FieldRow({ adapterKey, label, hint, required, isSecret, url, isSet, onSaved }: FieldRowProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adapterKey, value: value.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Failed to save');
      } else {
        setValue('');
        setSaved(true);
        onSaved(adapterKey);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-200">
          {label}
          {required && <span className="ml-1 text-red-400">*</span>}
        </span>
        {isSet && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            set
          </span>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            get key ↗
          </a>
        )}
      </div>
      <p className="text-xs text-zinc-500">{hint}</p>
      <form onSubmit={handleSubmit} className="flex gap-2 mt-0.5">
        <input
          type={isSecret ? 'password' : 'text'}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={isSet ? '••••••••' : 'Enter value…'}
          className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/25 focus:ring-0"
        />
        <button
          type="submit"
          disabled={!value.trim() || saving}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function SetupTab() {
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [vaultKeys, setVaultKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, vaultRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/vault'),
      ]);
      const settingsData = await settingsRes.json() as Record<string, string>;
      const vaultData = await vaultRes.json() as { keys?: string[] };
      const raw = settingsData['work_types'] ?? '[]';
      try {
        setWorkTypes(JSON.parse(raw) as string[]);
      } catch {
        setWorkTypes([]);
      }
      setVaultKeys(vaultData.keys ?? []);
    } catch {
      setWorkTypes([]);
      setVaultKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleSaved(key: string) {
    setVaultKeys(prev => prev.includes(key) ? prev : [...prev, key]);
  }

  if (loading) {
    return (
      <div className="p-8 text-zinc-500 text-sm">Loading…</div>
    );
  }

  if (workTypes.length === 0) {
    return (
      <div className="p-8 text-zinc-500 text-sm">
        No work types selected. Choose your work types in Global settings first.
      </div>
    );
  }

  const activeAdapters = ADAPTERS.filter(a => workTypes.includes(a.id));
  const totalFields = activeAdapters.reduce((sum, a) => sum + a.fields.length, 0);

  if (totalFields === 0) {
    return (
      <div className="p-8">
        <h2 className="text-base font-semibold text-zinc-100 mb-2">Setup</h2>
        <p className="text-sm text-zinc-500">No credentials required for your selected work types.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-base font-semibold text-zinc-100 mb-1">Setup</h2>
      <p className="text-xs text-zinc-500 mb-6">API keys and credentials for your selected work types.</p>
      <div className="flex flex-col gap-6">
        {activeAdapters.map(adapter => {
          if (adapter.fields.length === 0) return null;
          return (
            <div key={adapter.id} className="bg-zinc-800/40 border border-white/8 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{adapter.icon}</span>
                <span className="text-sm font-semibold text-zinc-200">{adapter.label}</span>
              </div>
              <div>
                {adapter.fields.map(field => (
                  <FieldRow
                    key={field.key}
                    adapterKey={field.key}
                    label={field.label}
                    hint={field.hint}
                    required={field.required}
                    isSecret={field.type === 'secret'}
                    url={field.url}
                    isSet={vaultKeys.includes(field.key)}
                    onSaved={handleSaved}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
