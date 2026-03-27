'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/contexts/LocaleContext';
import type { Locale } from '@/i18n';

type Settings = {
  github_username: string;
  github_token: string; // '***' when set, '' when not
  github_email: string;
  workspaces_dir: string;
  reflection_time: string; // HH:MM, e.g. "02:00"
  show_am_board: string; // 'true' | 'false'
};

type ReflectionStatus = {
  reflectionTime: string;
  installed: boolean;
  lastRun: string;
};

function Field({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  placeholder,
  masked,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  masked?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const inputType = masked ? (revealed ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500 pr-8"
        />
        {masked && (
          <button
            type="button"
            onClick={() => setRevealed(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
            title={revealed ? 'Hide' : 'Show'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              {revealed
                ? <><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></>
                : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
              }
            </svg>
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}

const LOCALES: { value: Locale; label: string; name: string }[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'es', label: 'ES', name: 'Español' },
  { value: 'zh', label: '中文', name: 'Chinese' },
];

export function GlobalSettingsModal({ onClose }: { onClose: () => void }) {
  const { locale, setLocale } = useLocale();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSet, setTokenSet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showTokenGuide, setShowTokenGuide] = useState(false);
  const [reflectionStatus, setReflectionStatus] = useState<ReflectionStatus | null>(null);
  const [reflectionRunning, setReflectionRunning] = useState(false);
  const [reflectionMsg, setReflectionMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((s: Settings) => {
      setSettings({ ...s, reflection_time: s.reflection_time || '02:00' });
      setTokenSet(s.github_token === '***');
    }).catch(() => {
      setSettings({ github_username: '', github_token: '', github_email: '', workspaces_dir: '~/workspaces', reflection_time: '02:00', show_am_board: 'true' });
    });
    fetch('/api/reflection').then(r => r.json()).then(setReflectionStatus).catch(() => null);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError('');
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        github_username: settings.github_username,
        github_email: settings.github_email,
        workspaces_dir: settings.workspaces_dir,
        reflection_time: settings.reflection_time,
      };
      if (tokenInput.trim()) body.github_token = tokenInput.trim();
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError('Failed to save.'); return; }
      const updated = await res.json() as Settings;
      setSettings(updated);
      setTokenSet(updated.github_token === '***');
      setTokenInput('');

      // Re-install launchd schedule if reflection_time changed
      if (reflectionStatus?.installed) {
        await fetch('/api/reflection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'install', time: updated.reflection_time }),
        });
        const rs = await fetch('/api/reflection').then(r => r.json());
        setReflectionStatus(rs);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xs sm:max-w-md bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Global Settings</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none">✕</button>
        </div>

        {!settings ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500">Loading…</div>
        ) : (
          <form onSubmit={handleSave} className="overflow-y-auto px-5 py-4 flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">GitHub</h3>
              <Field label="Username" value={settings.github_username} onChange={v => setSettings(s => s ? ({ ...s, github_username: v }) : s)} placeholder="your-github-username" />
              <Field label="Email" value={settings.github_email} onChange={v => setSettings(s => s ? ({ ...s, github_email: v }) : s)} placeholder="you@example.com" type="email" />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Personal Access Token (Classic)</label>
                  {tokenSet && <span className="text-[10px] font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-500/20 px-2 py-0.5 rounded">✓ set</span>}
                </div>
                <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder={tokenSet ? 'Enter new token to replace…' : 'ghp_xxxxxxxxxxxxxxxxxx'} className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                <button type="button" onClick={() => setShowTokenGuide(v => !v)} className="self-start text-xs text-pink-400 hover:text-pink-300 transition-colors">
                  {showTokenGuide ? '▲ Hide setup guide' : '▼ How to create a token'}
                </button>
                {showTokenGuide && (
                  <div className="bg-zinc-800/60 border border-white/10 rounded-lg px-4 py-3 flex flex-col gap-2.5 text-xs text-zinc-300">
                    <p className="font-semibold text-zinc-200">Create a Classic Personal Access Token</p>
                    <ol className="flex flex-col gap-1.5 text-zinc-400 list-decimal list-inside">
                      <li>Go to <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="text-pink-400 hover:text-pink-300 underline">github.com/settings/tokens/new</a></li>
                      <li>Give it a name like <span className="font-mono text-zinc-300">am-agent</span></li>
                      <li>Set <span className="font-semibold text-zinc-200">No expiration</span></li>
                      <li>Check <span className="font-semibold text-zinc-200">all scopes</span> — especially <span className="font-mono text-zinc-300">repo</span>, <span className="font-mono text-zinc-300">workflow</span></li>
                      <li>Click <span className="font-semibold text-zinc-200">Generate token</span> and paste above</li>
                    </ol>
                    <p className="text-zinc-600">Stored locally in your board database only.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Paths</h3>
              <Field label="Workspaces Directory" value={settings.workspaces_dir} onChange={v => setSettings(s => s ? ({ ...s, workspaces_dir: v }) : s)} placeholder="~/workspaces" hint="Where project repos are cloned when creating new projects" />
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Reflection (Nightly Memory)</h3>
              <p className="text-xs text-zinc-600">Examines short-term memories older than 48h and promotes, keeps, or drops them. Logs every run.</p>
              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Run Time</label>
                  <input
                    type="time"
                    value={settings?.reflection_time ?? '02:00'}
                    onChange={e => setSettings(s => s ? { ...s, reflection_time: e.target.value } : s)}
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Schedule</label>
                  <button
                    type="button"
                    onClick={async () => {
                      const time = settings?.reflection_time ?? '02:00';
                      const action = reflectionStatus?.installed ? 'uninstall' : 'install';
                      await fetch('/api/reflection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, time }) });
                      const rs = await fetch('/api/reflection').then(r => r.json());
                      setReflectionStatus(rs);
                    }}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${reflectionStatus?.installed ? 'border-emerald-500/30 text-emerald-400 bg-emerald-900/20 hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/30' : 'border-white/10 text-zinc-400 bg-zinc-800 hover:border-pink-500/40 hover:text-pink-300'}`}
                  >
                    {reflectionStatus?.installed ? '✓ Scheduled' : 'Install'}
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Manual</label>
                  <button
                    type="button"
                    disabled={reflectionRunning}
                    onClick={async () => {
                      setReflectionRunning(true);
                      setReflectionMsg('');
                      try {
                        const res = await fetch('/api/reflection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run-now' }) });
                        const data = await res.json() as { ok?: boolean; stdout?: string; stderr?: string; error?: string };
                        setReflectionMsg(data.ok ? '✓ done' : data.error ?? 'error');
                        const rs = await fetch('/api/reflection').then(r => r.json());
                        setReflectionStatus(rs);
                      } catch {
                        setReflectionMsg('error');
                      } finally {
                        setReflectionRunning(false);
                      }
                    }}
                    className="px-3 py-2 text-sm rounded-lg border border-white/10 text-zinc-400 bg-zinc-800 hover:border-pink-500/40 hover:text-pink-300 transition-colors disabled:opacity-50"
                  >
                    {reflectionRunning ? 'Running…' : 'Run Now'}
                  </button>
                </div>
              </div>
              {reflectionMsg && <p className="text-xs text-zinc-400">{reflectionMsg}</p>}
              {reflectionStatus?.lastRun && (
                <pre className="text-[10px] text-zinc-600 bg-zinc-900/60 border border-white/5 rounded px-3 py-2 overflow-auto max-h-24 whitespace-pre-wrap">{reflectionStatus.lastRun}</pre>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Appearance</h3>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Language</label>
                <select
                  value={locale}
                  onChange={e => setLocale(e.target.value as Locale)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer"
                >
                  {LOCALES.map(({ value, label, name }) => (
                    <option key={value} value={value}>{label} — {name}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <div className="text-sm text-red-300 bg-red-900/30 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white rounded-lg transition-colors">
                {saved ? '✓ Saved' : submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
