'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── types ─────────────────────────────────────────────────────────────────────

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  tags: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type Memory = {
  id: string;
  contactId: string;
  content: string;
  createdAt: string;
};

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ contact, size = 'md' }: { contact: Contact; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-14 w-14 text-xl' : size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  if (contact.avatarUrl) {
    return (
      <img
        src={contact.avatarUrl}
        alt={contact.name}
        className={`${cls} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div className={`${cls} rounded-full bg-pink-600/30 text-pink-300 font-semibold flex items-center justify-center shrink-0`}>
      {initials(contact.name)}
    </div>
  );
}

// ── ContactList ───────────────────────────────────────────────────────────────

function ContactList({
  contacts,
  selectedId,
  onSelect,
  onNew,
}: {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (c: Contact) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState('');
  const [filtered, setFiltered] = useState(contacts);

  useEffect(() => {
    if (!q.trim()) { setFiltered(contacts); return; }
    const lower = q.toLowerCase();
    setFiltered(contacts.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      (c.email ?? '').toLowerCase().includes(lower) ||
      (c.company ?? '').toLowerCase().includes(lower)
    ));
  }, [q, contacts]);

  return (
    <div className="flex flex-col h-full border-r border-zinc-800">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-200">Contacts</span>
        <button
          onClick={onNew}
          className="text-xs px-2 py-1 rounded bg-pink-500 hover:bg-pink-400 text-white font-medium transition-colors"
        >
          + New
        </button>
      </div>
      {/* search */}
      <div className="px-2 py-1.5 border-b border-zinc-800">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search…"
          className="w-full bg-zinc-800 text-zinc-200 text-sm rounded px-2 py-1 outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-pink-500"
        />
      </div>
      {/* list */}
      <ul className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-xs text-zinc-500 text-center">No contacts</li>
        )}
        {filtered.map(c => (
          <li
            key={c.id}
            onClick={() => onSelect(c)}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
              selectedId === c.id ? 'bg-zinc-700/60' : 'hover:bg-zinc-800/60'
            }`}
          >
            <Avatar contact={c} size="sm" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-200 truncate">{c.name}</div>
              {c.company && <div className="text-xs text-zinc-500 truncate">{c.company}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── NewContactForm ────────────────────────────────────────────────────────────

function NewContactForm({ onCreated, onCancel }: { onCreated: (c: Contact) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null, company: company.trim() || null }),
      });
      if (!res.ok) { setError('Failed to create contact'); return; }
      const contact: Contact = await res.json();
      onCreated(contact);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-200">New Contact</h3>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Name *</label>
        <input
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-zinc-800 text-zinc-200 text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-pink-500"
          placeholder="Jane Doe"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Email</label>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          type="email"
          className="w-full bg-zinc-800 text-zinc-200 text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-pink-500"
          placeholder="jane@example.com"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Company</label>
        <input
          value={company}
          onChange={e => setCompany(e.target.value)}
          className="w-full bg-zinc-800 text-zinc-200 text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-pink-500"
          placeholder="Acme Inc."
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="text-xs px-3 py-1.5 rounded bg-pink-500 hover:bg-pink-400 text-white font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ── ContactDetail ─────────────────────────────────────────────────────────────

type EditableField = 'name' | 'email' | 'phone' | 'company' | 'title' | 'tags';

function ContactDetail({
  contact,
  onUpdated,
  onDeleted,
}: {
  contact: Contact;
  onUpdated: (c: Contact) => void;
  onDeleted: (id: string) => void;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memInput, setMemInput] = useState('');
  const [addingMem, setAddingMem] = useState(false);
  const [editing, setEditing] = useState<Partial<Record<EditableField, string>>>({});
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/contacts/${contact.id}/memories`)
      .then(r => r.ok ? r.json() : [])
      .then(setMemories)
      .catch(() => {});
  }, [contact.id]);

  async function saveField(field: EditableField, value: string) {
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    });
    if (res.ok) {
      const updated: Contact = await res.json();
      onUpdated(updated);
    }
    setEditing(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  function startEdit(field: EditableField, current: string | null) {
    setEditing(prev => ({ ...prev, [field]: current ?? '' }));
  }

  async function addMemory() {
    if (!memInput.trim()) return;
    setAddingMem(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: memInput.trim() }),
      });
      if (res.ok) {
        const mem: Memory = await res.json();
        setMemories(prev => [...prev, mem]);
        setMemInput('');
      }
    } finally {
      setAddingMem(false);
    }
  }

  async function deleteMemory(memId: string) {
    await fetch(`/api/contacts/${contact.id}/memories/${memId}`, { method: 'DELETE' });
    setMemories(prev => prev.filter(m => m.id !== memId));
  }

  async function handleDelete() {
    if (!confirm(`Delete ${contact.name}?`)) return;
    setDeleting(true);
    await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
    onDeleted(contact.id);
  }

  function field(label: string, key: EditableField, value: string | null, inputType = 'text') {
    const isEditing = key in editing;
    return (
      <div className="grid grid-cols-[6rem_1fr] gap-x-2 items-center py-1">
        <span className="text-xs text-zinc-500">{label}</span>
        {isEditing ? (
          <input
            autoFocus
            type={inputType}
            value={editing[key] ?? ''}
            onChange={e => setEditing(prev => ({ ...prev, [key]: e.target.value }))}
            onBlur={() => saveField(key, editing[key] ?? '')}
            onKeyDown={e => { if (e.key === 'Enter') saveField(key, editing[key] ?? ''); if (e.key === 'Escape') setEditing(prev => { const n = { ...prev }; delete n[key]; return n; }); }}
            className="text-sm bg-zinc-700 text-zinc-200 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-pink-500"
          />
        ) : (
          <span
            onClick={() => startEdit(key, value)}
            className="text-sm text-zinc-200 cursor-text hover:bg-zinc-800/50 rounded px-1 py-0.5 min-h-[1.5rem] truncate"
            title="Click to edit"
          >
            {value ?? <span className="text-zinc-600 italic">—</span>}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
        <Avatar contact={contact} size="lg" />
        <div className="flex-1 min-w-0">
          {/* name is editable inline too */}
          {'name' in editing ? (
            <input
              autoFocus
              value={editing.name ?? ''}
              onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
              onBlur={() => saveField('name', editing.name ?? contact.name)}
              onKeyDown={e => { if (e.key === 'Enter') saveField('name', editing.name ?? contact.name); if (e.key === 'Escape') setEditing(prev => { const n = { ...prev }; delete n.name; return n; }); }}
              className="text-lg font-semibold bg-zinc-700 text-zinc-100 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-pink-500 w-full"
            />
          ) : (
            <h2
              onClick={() => startEdit('name', contact.name)}
              className="text-lg font-semibold text-zinc-100 truncate cursor-text hover:bg-zinc-800/50 rounded px-1"
              title="Click to edit"
            >
              {contact.name}
            </h2>
          )}
          {contact.title && <p className="text-xs text-zinc-400">{contact.title}</p>}
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs px-2 py-1 rounded bg-red-900/40 hover:bg-red-800/60 text-red-400 transition-colors disabled:opacity-50 shrink-0"
        >
          Delete
        </button>
      </div>

      {/* fields */}
      <div className="px-5 py-3 border-b border-zinc-800">
        {field('Email', 'email', contact.email, 'email')}
        {field('Phone', 'phone', contact.phone)}
        {field('Company', 'company', contact.company)}
        {field('Title', 'title', contact.title)}
        {field('Tags', 'tags', contact.tags)}
      </div>

      {/* memory timeline */}
      <div className="flex-1 flex flex-col px-5 py-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Notes &amp; Memories</h3>
        <div className="flex-1 flex flex-col gap-2 mb-4">
          {memories.length === 0 && (
            <p className="text-xs text-zinc-600 italic">No memories yet.</p>
          )}
          {memories.map(m => (
            <div key={m.id} className="group flex gap-2 items-start bg-zinc-800/40 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">{m.content}</p>
                <p className="text-xs text-zinc-600 mt-1">{fmtDate(m.createdAt)}</p>
              </div>
              <button
                onClick={() => deleteMemory(m.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all text-xs shrink-0 mt-0.5"
                title="Delete memory"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* add memory */}
        <div className="flex gap-2 items-end">
          <textarea
            value={memInput}
            onChange={e => setMemInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addMemory(); } }}
            placeholder="Add a note… (Enter to save)"
            rows={2}
            className="flex-1 bg-zinc-800 text-zinc-200 text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-pink-500 resize-none placeholder:text-zinc-600"
          />
          <button
            onClick={addMemory}
            disabled={addingMem || !memInput.trim()}
            className="text-xs px-3 py-1.5 rounded bg-pink-500 hover:bg-pink-400 text-white font-medium transition-colors disabled:opacity-50 shrink-0"
          >
            {addingMem ? '…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ContactsPanel (main export) ───────────────────────────────────────────────

export function ContactsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) setContacts(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  function handleCreated(c: Contact) {
    setContacts(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
    setSelected(c);
    setShowNew(false);
  }

  function handleUpdated(c: Contact) {
    setContacts(prev => prev.map(x => x.id === c.id ? c : x));
    setSelected(c);
  }

  function handleDeleted(id: string) {
    setContacts(prev => prev.filter(x => x.id !== id));
    setSelected(null);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl">
        {/* panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-sm font-semibold text-zinc-200">Contacts</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="flex-1 flex overflow-hidden">
          {/* left pane */}
          <div className="w-64 shrink-0 flex flex-col overflow-hidden">
            <ContactList
              contacts={contacts}
              selectedId={selected?.id ?? null}
              onSelect={(c) => { setSelected(c); setShowNew(false); }}
              onNew={() => { setShowNew(true); setSelected(null); }}
            />
          </div>

          {/* right pane */}
          <div className="flex-1 overflow-y-auto">
            {showNew ? (
              <NewContactForm
                onCreated={handleCreated}
                onCancel={() => setShowNew(false)}
              />
            ) : selected ? (
              <ContactDetail
                key={selected.id}
                contact={selected}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                Select a contact or create a new one
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
