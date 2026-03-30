'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import type { Locale } from '@/i18n';
import type { Project } from './BoardClient';
import { AM_BOARD_PROJECT_ID } from '@/lib/constants';
import { SetupTab } from './SetupTab';

// ─── Types ───────────────────────────────────────────────────────────────────

type GlobalSettings = {
  github_username: string;
  github_token: string;
  github_email: string;
  workspaces_dir: string;
  reflection_time: string;
  show_am_board: string;
  hidden_projects: string;
};

type ReflectionStatus = {
  reflectionTime: string;
  installed: boolean;
  lastRun: string;
};

type TeamRole = 'owner' | 'manager' | 'expert' | 'tester';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: TeamRole;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type EditState = { jobTitle: string; role: TeamRole };

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  projects: Project[];
  onProjectUpdated: (p: Project) => void;
  onProjectDeleted: (id: string) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LOCALES: { value: Locale; label: string; name: string }[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'es', label: 'ES', name: 'Español' },
  { value: 'zh', label: '中文', name: 'Chinese' },
];

const JOB_TITLES = [
  'Product Manager', 'Engineering Manager', 'Developer', 'Frontend Developer',
  'Backend Developer', 'Full-Stack Developer', 'Designer', 'UX Researcher',
  'Data Scientist', 'Data Analyst', 'Marketer', 'Growth', 'DevOps / Infra',
  'QA / Tester', 'Technical Writer', 'Sales', 'Customer Success', 'Finance',
  'Legal', 'Operations', 'Executive', 'Other',
] as const;

const ROLE_BADGE: Record<TeamRole, string> = {
  owner:   'bg-pink-500/20 text-pink-400 border-pink-500/30',
  manager: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  expert:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  tester:  'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
};

const WORKSPACE_BASE = '~/am/workspaces';
const EMPTY_ADD_FORM = { name: '', email: '', jobTitle: '', role: 'tester' as TeamRole };

// ─── Small helpers ───────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

function GlobalField({
  label, hint, value, onChange, type = 'text', placeholder, masked,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; masked?: boolean;
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

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function GlobalTabContent({ onClose, projects }: { onClose: () => void; projects: Project[] }) {
  const { locale, setLocale, t } = useLocale();
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
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
    fetch('/api/settings').then(r => r.json()).then((s: GlobalSettings) => {
      setSettings({ ...s, reflection_time: s.reflection_time || '02:00' });
      setTokenSet(s.github_token === '***');
    }).catch(() => {
      setSettings({ github_username: '', github_token: '', github_email: '', workspaces_dir: '~/workspaces', reflection_time: '02:00', show_am_board: 'true', hidden_projects: '["am-board-0000-0000-0000-000000000000"]' });
    });
    fetch('/api/reflection').then(r => r.json()).then(setReflectionStatus).catch(() => null);
  }, []);

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
        show_am_board: settings.show_am_board,
        hidden_projects: settings.hidden_projects,
      };
      if (tokenInput.trim()) body.github_token = tokenInput.trim();
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError('Failed to save.'); return; }
      const updated = await res.json() as GlobalSettings;
      setSettings(updated);
      setTokenSet(updated.github_token === '***');
      setTokenInput('');

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
      window.dispatchEvent(new CustomEvent('settings-changed'));
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!settings) {
    return <div className="px-6 py-8 text-center text-sm text-zinc-500">Loading…</div>;
  }

  return (
    <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">GitHub</h3>
        <GlobalField label="Username" value={settings.github_username} onChange={v => setSettings(s => s ? ({ ...s, github_username: v }) : s)} placeholder="your-github-username" />
        <GlobalField label="Email" value={settings.github_email} onChange={v => setSettings(s => s ? ({ ...s, github_email: v }) : s)} placeholder="you@example.com" type="email" />
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
        <GlobalField label="Workspaces Directory" value={settings.workspaces_dir} onChange={v => setSettings(s => s ? ({ ...s, workspaces_dir: v }) : s)} placeholder="~/workspaces" hint="Where project repos are cloned when creating new projects" />
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

      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('projectVisibility')}</h3>
        {(() => {
          let hidden: string[] = [];
          try { hidden = JSON.parse(settings.hidden_projects || '[]'); } catch {}
          const visibleProjects = projects.filter(p => !p.isTest);
          const allEntries: { id: string; name: string }[] = [
            { id: AM_BOARD_PROJECT_ID, name: 'HelloAm!' },
            ...visibleProjects.map(p => ({ id: p.id, name: p.name })),
          ];
          return allEntries.map(entry => {
            const isVisible = !hidden.includes(entry.id);
            return (
              <label key={entry.id} className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={e => {
                    setSettings(s => {
                      if (!s) return s;
                      let arr: string[] = [];
                      try { arr = JSON.parse(s.hidden_projects || '[]'); } catch {}
                      if (e.target.checked) {
                        arr = arr.filter(id => id !== entry.id);
                      } else {
                        if (!arr.includes(entry.id)) arr = [...arr, entry.id];
                      }
                      return { ...s, hidden_projects: JSON.stringify(arr) };
                    });
                  }}
                  className="w-4 h-4 rounded border border-white/20 bg-zinc-800 accent-pink-500 cursor-pointer"
                />
                <span className="text-sm text-zinc-300">{entry.name}</span>
                <span className="text-xs text-zinc-600">{t('showInSidebar')}</span>
              </label>
            );
          });
        })()}
      </div>

      {error && <div className="text-sm text-red-300 bg-red-900/30 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">Cancel</button>
        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white rounded-lg transition-colors">
          {saved ? '✓ Saved' : submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function MemberRow({ member, onEdit, onDelete }: { member: TeamMember; onEdit: (id: string, data: EditState) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditState>({ jobTitle: member.jobTitle, role: member.role });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onEdit(member.id, form);
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setForm({ jobTitle: member.jobTitle, role: member.role });
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-zinc-800/60 border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-100 truncate">{member.name}</div>
          <div className="text-xs text-zinc-500 truncate">{member.email}</div>
          {!editing && member.jobTitle && (
            <div className="text-xs text-zinc-400 mt-0.5 truncate">{member.jobTitle}</div>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge label={member.role} className={ROLE_BADGE[member.role]} />
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 mt-1">
          <select
            value={form.jobTitle}
            onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
            className="text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
          >
            <option value="">{t('jobTitle')}</option>
            {JOB_TITLES.map(jt => <option key={jt} value={jt}>{jt}</option>)}
          </select>
          <div className="flex gap-2">
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as TeamRole }))}
              className="flex-1 text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            >
              <option value="owner">{t('roleOwner')}</option>
              <option value="manager">{t('roleManager')}</option>
              <option value="expert">{t('roleExpert')}</option>
              <option value="tester">{t('roleTester')}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white font-medium transition-colors">
              {saving ? t('saving') : t('save')}
            </button>
            <button onClick={handleCancel} className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors">
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="text-xs px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors">
            {t('edit')}
          </button>
          <button onClick={() => onDelete(member.id)} className="text-xs px-2 py-1 rounded-md bg-zinc-700 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors">
            {t('delete')}
          </button>
        </div>
      )}
    </div>
  );
}

function TeamTabContent({ active }: { active: boolean }) {
  const { t } = useLocale();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch('/api/team');
      if (res.ok) setMembers(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (active) fetchMembers(true);
  }, [active, fetchMembers]);

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      setError(t('nameEmailRequired'));
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        const member: TeamMember = await res.json();
        setMembers(prev => [...prev, member]);
        setAddForm(EMPTY_ADD_FORM);
        setShowAdd(false);
      } else {
        const data = await res.json();
        setError(data?.error?.formErrors?.[0] ?? t('failedToAddMember'));
      }
    } catch {
      setError(t('networkErrorShort'));
    }
    setAdding(false);
  }

  async function handleEdit(id: string, data: EditState) {
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated: TeamMember = await res.json();
        setMembers(prev => prev.map(m => m.id === id ? updated : m));
      }
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        setMembers(prev => prev.filter(m => m.id !== id));
      }
    } catch {}
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <h2 className="text-sm font-semibold text-zinc-100">{t('team')}</h2>
        <button
          onClick={() => { setShowAdd(v => !v); setError(null); }}
          className="text-xs px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 transition-colors"
        >
          {t('addMemberButton')}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="px-6 py-3 border-b border-white/5 bg-zinc-800/40 flex flex-col gap-2 shrink-0">
          <input
            type="text"
            value={addForm.name}
            onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
            placeholder={t('name') + ' *'}
            className="text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
          />
          <input
            type="email"
            value={addForm.email}
            onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
            placeholder={t('email') + ' *'}
            className="text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
          />
          <select
            value={addForm.jobTitle}
            onChange={e => setAddForm(f => ({ ...f, jobTitle: e.target.value }))}
            className="text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
          >
            <option value="">{t('jobTitle')}</option>
            {JOB_TITLES.map(jt => <option key={jt} value={jt}>{jt}</option>)}
          </select>
          <div className="flex gap-2">
            <select
              value={addForm.role}
              onChange={e => setAddForm(f => ({ ...f, role: e.target.value as TeamRole }))}
              className="flex-1 text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            >
              <option value="owner">{t('roleOwner')}</option>
              <option value="manager">{t('roleManager')}</option>
              <option value="expert">{t('roleExpert')}</option>
              <option value="tester">{t('roleTester')}</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={adding} className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white font-medium transition-colors">
              {adding ? t('adding') : t('addMember')}
            </button>
            <button onClick={() => { setShowAdd(false); setError(null); setAddForm(EMPTY_ADD_FORM); }} className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {loading && <p className="text-sm text-zinc-500 text-center py-8">{t('loading')}</p>}
        {!loading && members.length === 0 && (
          <p className="text-sm text-zinc-500 text-center py-8">{t('noTeamMembers')}</p>
        )}
        {members.map(member => (
          <MemberRow key={member.id} member={member} onEdit={handleEdit} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}

function ProjectTabContent({
  project,
  onProjectUpdated,
  onProjectDeleted,
  onClose,
}: {
  project: Project | null;
  onProjectUpdated: (p: Project) => void;
  onProjectDeleted: (id: string) => void;
  onClose: () => void;
}) {
  if (!project) {
    return <AmBoardContent />;
  }

  return (
    <ProjectFormContent
      project={project}
      onUpdate={onProjectUpdated}
      onDelete={onProjectDeleted}
      onClose={onClose}
    />
  );
}

function AmBoardContent() {
  const { t } = useLocale();
  const [version, setVersion] = useState<string>('…');

  useEffect(() => {
    fetch('/api/version')
      .then(r => r.json())
      .then((data: { version: string }) => setVersion(data.version))
      .catch(() => setVersion('unknown'));
  }, []);

  function ReadOnlyField({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
          {label}
          <span className="text-[10px] font-normal normal-case tracking-normal text-zinc-600 bg-zinc-800 border border-white/5 px-1.5 py-0.5 rounded">{t('locked')}</span>
        </label>
        <div className="bg-zinc-800/50 border border-white/5 rounded-lg px-3 py-2 font-mono text-sm text-zinc-500 select-all cursor-default">
          {value}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-zinc-300">HelloAm!</h2>
      <ReadOnlyField label={t('displayName')} value="HelloAm!" />
      <ReadOnlyField label={t('version')} value={version} />
      <div className="flex flex-col gap-1">
        <p className="text-xs text-zinc-600">docs · media · notes live inside the repo root, gitignored</p>
        <p className="text-xs text-zinc-700">The repo root is the project — these settings are fixed.</p>
      </div>
    </div>
  );
}

function ProjectFormContent({
  project,
  onUpdate,
  onDelete,
  onClose,
}: {
  project: Project;
  onUpdate: (p: Project) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState(project.name);
  const [versioned, setVersioned] = useState(project.versioned);
  const [isTest, setIsTest] = useState(project.isTest);
  const [githubRepo, setGithubRepo] = useState(project.githubRepo ?? '');
  const [vercelUrl, setVercelUrl] = useState(project.vercelUrl ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const slug = slugify(name);
  const repoDir = slug ? `${WORKSPACE_BASE}/${slug}` : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t('nameRequired')); return; }
    setError('');
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), versioned, isTest };
      if (versioned) body.repoDir = repoDir;
      body.githubRepo = githubRepo.trim();
      body.vercelUrl = vercelUrl.trim();
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) { setError(t('duplicateProject')); return; }
      if (!res.ok) { setError(t('failedToSave')); return; }
      onUpdate(await res.json());
      onClose();
    } catch {
      setError(t('networkErrorShort'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setError('');
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (!res.ok) { setError(t('failedToDelete')); return; }
      onDelete(project.id);
    } catch {
      setError(t('networkErrorShort'));
    } finally {
      setDeleting(false);
    }
  }

  const isDirty = name.trim() !== project.name || versioned !== project.versioned || isTest !== project.isTest
    || githubRepo.trim() !== (project.githubRepo ?? '') || vercelUrl.trim() !== (project.vercelUrl ?? '');

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sp-field-name" className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('displayName')}</label>
        <input
          id="sp-field-name"
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          autoFocus
          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        />
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={versioned}
          onChange={e => setVersioned(e.target.checked)}
          className="w-4 h-4 rounded border-white/10 bg-zinc-800 text-pink-500 focus:ring-pink-500 focus:ring-offset-0 cursor-pointer"
        />
        <span className="text-sm text-zinc-300">{t('versioned')}</span>
        <span className="text-xs text-zinc-600">{t('versionedHint')}</span>
      </label>

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isTest}
          onChange={e => setIsTest(e.target.checked)}
          className="w-4 h-4 rounded border-white/10 bg-zinc-800 text-pink-500 focus:ring-pink-500 focus:ring-offset-0 cursor-pointer"
        />
        <span className="text-sm text-zinc-300">{t('testProject')}</span>
        <span className="text-xs text-zinc-600">{t('testProjectHint')}</span>
      </label>

      {versioned && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('slug')}</label>
            <div className="bg-zinc-800/50 border border-white/5 rounded-lg px-3 py-2 font-mono text-sm text-zinc-500 select-all">
              {slug || <span className="text-zinc-700">—</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('workDirectory')}</label>
            <div className="bg-zinc-800/50 border border-white/5 rounded-lg px-3 py-2 font-mono text-sm text-zinc-500 select-all">
              {repoDir || <span className="text-zinc-700">—</span>}
            </div>
            <p className="text-xs text-zinc-600">{t('autoGeneratedWorkDir')}</p>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 pt-1 border-t border-white/5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('githubRepoLabel')}</label>
          <input
            type="text"
            value={githubRepo}
            onChange={e => setGithubRepo(e.target.value)}
            placeholder="owner/repo"
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <p className="text-xs text-zinc-600">{t('githubRepoHint')}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('vercelUrlLabel')}</label>
          <input
            type="url"
            value={vercelUrl}
            onChange={e => setVercelUrl(e.target.value)}
            placeholder="https://your-app.vercel.app"
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-300 bg-red-900/30 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
      )}

      {confirmDelete ? (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-sm text-red-300">{t('areYouSure')}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {deleting ? t('deleting') : t('confirm')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={submitting}
            className="text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {t('deleteProject')}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">{t('cancel')}</button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !isDirty}
              className="px-4 py-2 text-sm font-medium bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {submitting ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ─── Vault tab ───────────────────────────────────────────────────────────────

function VaultTabContent() {
  const [vaultReady, setVaultReady] = useState<boolean | null>(null);
  const [vaultReadyReason, setVaultReadyReason] = useState('');
  const [keys, setKeys] = useState<string[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const res = await fetch('/api/vault');
      const data = await res.json() as { keys?: string[]; error?: string };
      setKeys(data.keys ?? []);
    } catch {
      setKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/vault/check')
      .then(r => r.json())
      .then((d: { ready: boolean; reason?: string }) => {
        setVaultReady(d.ready);
        setVaultReadyReason(d.reason ?? '');
      })
      .catch(() => { setVaultReady(false); setVaultReadyReason('Could not reach vault'); });

    loadKeys();
  }, [loadKeys]);

  async function handleRemove(key: string) {
    if (!confirm(`Remove secret "${key}"?`)) return;
    setRemovingKey(key);
    try {
      await fetch(`/api/vault?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      await loadKeys();
    } finally {
      setRemovingKey(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    if (!/^[a-zA-Z0-9_-]+$/.test(newKey)) {
      setAddError('Key name must match /^[a-zA-Z0-9_-]+$/');
      return;
    }
    if (!newValue) {
      setAddError('Value is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setAddError(d.error ?? 'Failed to save');
        return;
      }
      setNewKey('');
      setNewValue('');
      await loadKeys();
    } catch {
      setAddError('Network error');
    } finally {
      setSaving(false);
    }
  }

  const tavilyEnabled = keys.includes('tavily_api_key');

  return (
    <div className="px-6 py-5 flex flex-col gap-6">
      {/* Status */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vault Status</h3>
        <div className="flex items-center gap-2.5">
          {vaultReady === null ? (
            <span className="text-xs text-zinc-500">Checking…</span>
          ) : vaultReady ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
              Ready
            </span>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                Not Ready
              </span>
              {vaultReadyReason && (
                <p className="text-xs text-zinc-600 mt-1">{vaultReadyReason}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Secrets list */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Secrets</h3>
        {loadingKeys ? (
          <p className="text-xs text-zinc-500">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-xs text-zinc-600">No secrets stored yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {keys.map(k => (
              <div key={k} className="flex items-center justify-between bg-zinc-800/60 border border-white/[0.06] rounded-lg px-3 py-2">
                <span className="text-sm font-mono text-zinc-300">{k}</span>
                <button
                  onClick={() => handleRemove(k)}
                  disabled={removingKey === k}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {removingKey === k ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add secret form */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Add Secret</h3>
        <form onSubmit={handleAdd} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Key Name</label>
            <input
              type="text"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="e.g. tavily_api_key"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Value</label>
            <input
              type="password"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder="Secret value"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <button
            type="submit"
            disabled={saving}
            className="self-start px-4 py-2 text-sm rounded-lg bg-pink-600 hover:bg-pink-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Secret'}
          </button>
        </form>
      </div>

      {/* Integrations */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Integrations</h3>
        <div className="flex items-center justify-between bg-zinc-800/60 border border-white/[0.06] rounded-lg px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-zinc-200">Web Search</span>
            <span className="text-xs text-zinc-500">Tavily — set <span className="font-mono">tavily_api_key</span> to enable</span>
          </div>
          {tavilyEnabled ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
              Enabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-700/40 text-zinc-400 border border-zinc-600/30">
              Disabled
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

type Tab = 'global' | 'team' | 'project' | 'vault' | 'setup';

export function SettingsPanel({ open, onClose, project, projects, onProjectUpdated, onProjectDeleted }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('project');
  const [settingsProject, setSettingsProject] = useState<Project | null>(project);

  // Sync settingsProject when panel opens or project changes
  useEffect(() => {
    if (open) setSettingsProject(project);
  }, [open, project]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const simpleNavItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'global',
      label: 'Global',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      ),
    },
    {
      id: 'team',
      label: 'Team',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      id: 'vault' as Tab,
      label: 'Vault',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
    },
    {
      id: 'setup' as Tab,
      label: 'Setup',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
      ),
    },
  ];

  const gearIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{
        transform: open ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="flex flex-1 overflow-hidden bg-zinc-900">
        {/* Left sidebar */}
        <div className="w-52 shrink-0 border-r border-white/10 flex flex-col pt-4 pb-4 gap-1">
          <div className="px-4 pb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Settings</span>
            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-300 transition-colors"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {simpleNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mx-2 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeTab === item.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
          {/* Project selector nav item */}
          <div
            className={`mx-2 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === 'project'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => setActiveTab('project')}
          >
            {gearIcon}
            <select
              value={settingsProject?.id ?? ''}
              onChange={e => {
                const id = e.target.value;
                setSettingsProject(projects.find(p => p.id === id) ?? null);
                setActiveTab('project');
              }}
              onClick={e => e.stopPropagation()}
              className="flex-1 min-w-0 bg-transparent text-inherit text-sm focus:outline-none cursor-pointer truncate"
            >
              <option value="">HelloAm!</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'global' && <GlobalTabContent onClose={onClose} projects={projects} />}
          {activeTab === 'team' && <TeamTabContent active={activeTab === 'team'} />}
          {activeTab === 'project' && (
            <ProjectTabContent
              project={settingsProject}
              onProjectUpdated={onProjectUpdated}
              onProjectDeleted={onProjectDeleted}
              onClose={onClose}
            />
          )}
          {activeTab === 'vault' && <VaultTabContent />}
          {activeTab === 'setup' && <SetupTab />}
        </div>
      </div>
    </div>
  );
}
