'use client';

import { useState, useEffect, useCallback } from 'react';

type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';
type TeamAvailability = 'available' | 'busy' | 'away' | 'offline';

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: TeamRole;
  availability: TeamAvailability;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const AVAILABILITY_BADGE: Record<TeamAvailability, string> = {
  available: 'bg-green-500/20 text-green-400 border-green-500/30',
  busy: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  away: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  offline: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
};

const ROLE_BADGE: Record<TeamRole, string> = {
  owner: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  admin: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
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
  availability: TeamAvailability;
};

function MemberRow({
  member,
  onEdit,
  onDelete,
}: {
  member: TeamMember;
  onEdit: (id: string, data: EditState) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditState>({
    jobTitle: member.jobTitle,
    role: member.role,
    availability: member.availability,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onEdit(member.id, form);
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setForm({ jobTitle: member.jobTitle, role: member.role, availability: member.availability });
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
            <Badge label={member.availability} className={AVAILABILITY_BADGE[member.availability]} />
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 mt-1">
          <input
            type="text"
            value={form.jobTitle}
            onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
            placeholder="Job title"
            className="text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
          />
          <div className="flex gap-2">
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as TeamRole }))}
              className="flex-1 text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            >
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="member">member</option>
              <option value="viewer">viewer</option>
            </select>
            <select
              value={form.availability}
              onChange={e => setForm(f => ({ ...f, availability: e.target.value as TeamAvailability }))}
              className="flex-1 text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            >
              <option value="available">available</option>
              <option value="busy">busy</option>
              <option value="away">away</option>
              <option value="offline">offline</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(member.id)}
            className="text-xs px-2 py-1 rounded-md bg-zinc-700 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors"
          >
            Delete
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
  role: 'member' as TeamRole,
  availability: 'available' as TeamAvailability,
};

export function TeamPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/team');
      if (res.ok) setMembers(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchMembers();
  }, [open, fetchMembers]);

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      setError('Name and email are required.');
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
        setAddForm(EMPTY_FORM);
        setShowAdd(false);
      } else {
        const data = await res.json();
        setError(data?.error?.formErrors?.[0] ?? 'Failed to add member.');
      }
    } catch {
      setError('Network error.');
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm bg-zinc-900 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">Team</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAdd(v => !v); setError(null); }}
              className="text-xs px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 transition-colors"
            >
              + Add member
            </button>
            <button
              onClick={onClose}
              className="text-xs px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="px-4 py-3 border-b border-white/5 bg-zinc-800/40 flex flex-col gap-2 shrink-0">
            <input
              type="text"
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Name *"
              className="text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            />
            <input
              type="email"
              value={addForm.email}
              onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email *"
              className="text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            />
            <input
              type="text"
              value={addForm.jobTitle}
              onChange={e => setAddForm(f => ({ ...f, jobTitle: e.target.value }))}
              placeholder="Job title"
              className="text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            />
            <div className="flex gap-2">
              <select
                value={addForm.role}
                onChange={e => setAddForm(f => ({ ...f, role: e.target.value as TeamRole }))}
                className="flex-1 text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
              >
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
              <select
                value={addForm.availability}
                onChange={e => setAddForm(f => ({ ...f, availability: e.target.value as TeamAvailability }))}
                className="flex-1 text-sm bg-zinc-700 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
              >
                <option value="available">available</option>
                <option value="busy">busy</option>
                <option value="away">away</option>
                <option value="offline">offline</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={adding}
                className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {adding ? 'Adding…' : 'Add member'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setError(null); setAddForm(EMPTY_FORM); }}
                className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Member list */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {loading && <p className="text-sm text-zinc-500 text-center py-8">Loading…</p>}
          {!loading && members.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">No team members yet.</p>
          )}
          {members.map(member => (
            <MemberRow
              key={member.id}
              member={member}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
