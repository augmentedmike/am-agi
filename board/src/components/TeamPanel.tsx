'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { ContactViewPanel } from './ContactViewPanel';

type TeamRole = 'owner' | 'manager' | 'expert' | 'tester';

const JOB_TITLES = [
  'Product Manager',
  'Engineering Manager',
  'Developer',
  'Frontend Developer',
  'Backend Developer',
  'Full-Stack Developer',
  'Designer',
  'UX Researcher',
  'Data Scientist',
  'Data Analyst',
  'Marketer',
  'Growth',
  'DevOps / Infra',
  'QA / Tester',
  'Technical Writer',
  'Sales',
  'Customer Success',
  'Finance',
  'Legal',
  'Operations',
  'Executive',
  'Other',
] as const;

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: TeamRole;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};


const ROLE_BADGE: Record<TeamRole, string> = {
  owner:   'bg-pink-500/20 text-pink-400 border-pink-500/30',
  manager: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  expert:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  tester:  'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

type EditState = {
  jobTitle: string;
  role: TeamRole;
};

function MemberRow({
  member,
  onEdit,
  onDelete,
  onClick,
}: {
  member: TeamMember;
  onEdit: (id: string, data: EditState) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClick: (member: TeamMember) => void;
}) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditState>({
    jobTitle: member.jobTitle,
    role: member.role,
  });
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
    <div
      className="flex flex-col gap-2 p-3 rounded-lg bg-zinc-800/60 border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
      onClick={() => !editing && onClick(member)}
    >
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
        <div className="flex flex-col gap-2 mt-1" onClick={e => e.stopPropagation()}>
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
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {saving ? t('saving') : t('save')}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
          >
            {t('edit')}
          </button>
          <button
            onClick={() => onDelete(member.id)}
            className="text-xs px-2 py-1 rounded-md bg-zinc-700 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors"
          >
            {t('delete')}
          </button>
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  name: '',
  email: '',
  jobTitle: '',
  role: 'tester' as TeamRole,
  avatarUrl: '',
};

export function TeamPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<TeamMember | null>(null);

  const fetchMembers = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch('/api/team');
      if (res.ok) setMembers(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchMembers(true);
  }, [open, fetchMembers]);

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      setError(t('nameEmailRequired'));
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const payload = {
        ...addForm,
        avatarUrl: addForm.avatarUrl.trim() || null,
      };
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const member: TeamMember = await res.json();
        setMembers(prev => [...prev, member]);
        setAddForm(EMPTY_FORM);
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

  const filteredMembers = searchQuery.trim()
    ? members.filter(m => {
        const q = searchQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.jobTitle.toLowerCase().includes(q)
        );
      })
    : members;

  if (!open) return null;

  if (selectedContact) {
    return (
      <ContactViewPanel
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm bg-zinc-900 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">{t('team')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAdd(v => !v); setError(null); }}
              className="text-xs px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 transition-colors"
            >
              {t('addMemberButton')}
            </button>
            <button
              onClick={onClose}
              className="text-xs px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 py-2 border-b border-white/5 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('contactSearch')}
            className="w-full text-sm bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
          />
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="px-4 py-3 border-b border-white/5 bg-zinc-800/40 flex flex-col gap-2 shrink-0">
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
            <input
              type="url"
              value={addForm.avatarUrl}
              onChange={e => setAddForm(f => ({ ...f, avatarUrl: e.target.value }))}
              placeholder={t('avatarUrl')}
              className="text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            />
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
              <button
                onClick={handleAdd}
                disabled={adding}
                className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {adding ? t('adding') : t('addMember')}
              </button>
              <button
                onClick={() => { setShowAdd(false); setError(null); setAddForm(EMPTY_FORM); }}
                className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
              >
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
          {!loading && members.length > 0 && filteredMembers.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">{t('noContactsFound')}</p>
          )}
          {filteredMembers.map(member => (
            <MemberRow
              key={member.id}
              member={member}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onClick={setSelectedContact}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
