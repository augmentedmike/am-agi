'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── types ─────────────────────────────────────────────────────────────────────

type Stage = {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  color: string | null;
  isTerminal: boolean;
  entryCount?: number;
};

type PipelineContact = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  title: string | null;
  tags: string | null;
  avatarUrl: string | null;
};

type Entry = {
  id: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  createdAt: string;
  updatedAt: string;
  contact: PipelineContact;
};

type Pipeline = {
  id: string;
  name: string;
  description: string | null;
  stages: Stage[];
};

type ViewMode = 'kanban' | 'table';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ contact, size = 'sm' }: { contact: PipelineContact; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-8 w-8 text-sm' : 'h-6 w-6 text-xs';
  if (contact.avatarUrl) {
    return <img src={contact.avatarUrl} alt={contact.name} className={`${cls} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${cls} rounded-full bg-pink-600/30 text-pink-300 font-semibold flex items-center justify-center shrink-0`}>
      {initials(contact.name)}
    </div>
  );
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

function KanbanCard({
  entry,
  onDragStart,
  onClick,
}: {
  entry: Entry;
  onDragStart: (e: React.DragEvent, entry: Entry) => void;
  onClick: (contactId: string) => void;
}) {
  const tags = entry.contact.tags ? entry.contact.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, entry)}
      onClick={() => onClick(entry.contactId)}
      className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 cursor-pointer hover:border-pink-500/50 hover:bg-zinc-750 transition-all select-none"
    >
      <div className="flex items-start gap-2">
        <Avatar contact={entry.contact} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{entry.contact.name}</p>
          {entry.contact.company && (
            <p className="text-xs text-zinc-400 truncate">{entry.contact.company}</p>
          )}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">{tag}</span>
          ))}
          {tags.length > 3 && <span className="text-xs text-zinc-500">+{tags.length - 3}</span>}
        </div>
      )}
      <p className="text-xs text-zinc-500 mt-2">Added {fmtDate(entry.createdAt)}</p>
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  entries,
  onDragStart,
  onDrop,
  onDragOver,
  onCardClick,
}: {
  stage: Stage;
  entries: Entry[];
  onDragStart: (e: React.DragEvent, entry: Entry) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onCardClick: (contactId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const color = stage.color ?? '#6366f1';

  return (
    <div
      className={`flex flex-col w-64 shrink-0 rounded-lg border transition-colors ${
        dragOver ? 'border-pink-500 bg-zinc-800/60' : 'border-zinc-700 bg-zinc-900/40'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); onDragOver(e); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { setDragOver(false); onDrop(e, stage.id); }}
    >
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700/50">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-zinc-200 truncate flex-1">{stage.name}</span>
        <span className="text-xs text-zinc-500 font-mono shrink-0">{entries.length}</span>
      </div>
      {/* cards */}
      <div className="flex flex-col gap-2 p-2 min-h-[80px]">
        {entries.map(entry => (
          <KanbanCard key={entry.id} entry={entry} onDragStart={onDragStart} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}

// ── TableView ─────────────────────────────────────────────────────────────────

function TableView({
  entries,
  stages,
  filterStageId,
  onFilterStage,
  onRowClick,
}: {
  entries: Entry[];
  stages: Stage[];
  filterStageId: string | null;
  onFilterStage: (id: string | null) => void;
  onRowClick: (contactId: string) => void;
}) {
  const filtered = filterStageId ? entries.filter(e => e.stageId === filterStageId) : entries;
  const stageMap = Object.fromEntries(stages.map(s => [s.id, s]));

  return (
    <div className="flex flex-col gap-3">
      {/* stage filter chips */}
      <div className="flex gap-2 flex-wrap px-1">
        <button
          onClick={() => onFilterStage(null)}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
            !filterStageId ? 'bg-pink-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          All ({entries.length})
        </button>
        {stages.map(s => {
          const count = entries.filter(e => e.stageId === s.id).length;
          return (
            <button
              key={s.id}
              onClick={() => onFilterStage(s.id === filterStageId ? null : s.id)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5 ${
                filterStageId === s.id ? 'bg-pink-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color ?? '#6366f1' }} />
              {s.name} ({count})
            </button>
          );
        })}
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Contact</th>
              <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Company</th>
              <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Stage</th>
              <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Added</th>
              <th className="text-left text-xs font-medium text-zinc-400 px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500 text-xs">No contacts in this pipeline yet.</td>
              </tr>
            )}
            {filtered.map(entry => {
              const stage = stageMap[entry.stageId];
              return (
                <tr
                  key={entry.id}
                  onClick={() => onRowClick(entry.contactId)}
                  className="border-b border-zinc-800 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar contact={entry.contact} />
                      <span className="text-zinc-200 font-medium">{entry.contact.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{entry.contact.company ?? '—'}</td>
                  <td className="px-3 py-2">
                    {stage && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${stage.color ?? '#6366f1'}22`, color: stage.color ?? '#6366f1' }}
                      >
                        {stage.name}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-500 text-xs">{fmtDate(entry.createdAt)}</td>
                  <td className="px-3 py-2 text-zinc-500 text-xs">{fmtDate(entry.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── AddContactModal ───────────────────────────────────────────────────────────

function AddContactModal({
  pipelineId,
  stages,
  onClose,
  onAdded,
}: {
  pipelineId: string;
  stages: Stage[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [contacts, setContacts] = useState<{ id: string; name: string; company: string | null }[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState(stages[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/contacts').then(r => r.json()).then((data: any[]) => setContacts(data)).catch(() => {});
  }, []);

  const filtered = q.trim()
    ? contacts.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : contacts;

  const handleAdd = async () => {
    if (!selectedContactId || !selectedStageId) return;
    setLoading(true);
    await fetch(`/api/pipelines/${pipelineId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: selectedContactId, stageId: selectedStageId }),
    });
    setLoading(false);
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-96 max-w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">Add Contact to Pipeline</h3>

        <div className="mb-3">
          <label className="text-xs text-zinc-400 mb-1 block">Search contacts</label>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Type to search..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-pink-500"
          />
        </div>

        <div className="mb-3 max-h-40 overflow-y-auto border border-zinc-700 rounded">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedContactId(c.id)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-700 transition-colors ${
                selectedContactId === c.id ? 'bg-pink-600/20 text-pink-300' : 'text-zinc-300'
              }`}
            >
              {c.name} {c.company ? <span className="text-zinc-500">· {c.company}</span> : null}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-2 text-xs text-zinc-500">No contacts found</p>}
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-400 mb-1 block">Stage</label>
          <select
            value={selectedStageId}
            onChange={e => setSelectedStageId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-pink-500"
          >
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={!selectedContactId || loading}
            className="text-xs px-3 py-1.5 rounded bg-pink-600 text-white hover:bg-pink-500 disabled:opacity-50"
          >
            {loading ? 'Adding…' : 'Add to Pipeline'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NewPipelineModal ──────────────────────────────────────────────────────────

function NewPipelineModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    const pipeline = await res.json();
    setLoading(false);
    onCreated(pipeline.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-80" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">New Pipeline</h3>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Pipeline name"
          autoFocus
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-pink-500 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="text-xs px-3 py-1.5 rounded bg-pink-600 text-white hover:bg-pink-500 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PipelinePanel (main) ──────────────────────────────────────────────────────

export default function PipelinePanel({ onContactSelect }: { onContactSelect?: (contactId: string) => void }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filterStageId, setFilterStageId] = useState<string | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [dragEntry, setDragEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  const activePipeline = pipelines.find(p => p.id === activePipelineId) ?? null;

  const loadPipelines = useCallback(async () => {
    const res = await fetch('/api/pipelines');
    const data: Pipeline[] = await res.json();
    setPipelines(data);
    if (data.length > 0 && !activePipelineId) {
      setActivePipelineId(data[0].id);
    }
    setLoading(false);
  }, [activePipelineId]);

  const loadEntries = useCallback(async (pipelineId: string) => {
    const res = await fetch(`/api/pipelines/${pipelineId}/entries`);
    const data: Entry[] = await res.json();
    setEntries(data);
  }, []);

  useEffect(() => { loadPipelines(); }, []);
  useEffect(() => {
    if (activePipelineId) loadEntries(activePipelineId);
  }, [activePipelineId]);

  const handleDragStart = (e: React.DragEvent, entry: Entry) => {
    setDragEntry(entry);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (!dragEntry || dragEntry.stageId === stageId) { setDragEntry(null); return; }
    await fetch(`/api/pipelines/${activePipelineId}/entries/${dragEntry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageId }),
    });
    setDragEntry(null);
    if (activePipelineId) loadEntries(activePipelineId);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">Loading pipelines…</div>;
  }

  const stages = activePipeline?.stages ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 shrink-0 flex-wrap">
        {/* pipeline selector */}
        <select
          value={activePipelineId ?? ''}
          onChange={e => setActivePipelineId(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-pink-500 max-w-[180px]"
        >
          {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* new pipeline */}
        <button
          onClick={() => setShowNewPipeline(true)}
          className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
          title="New Pipeline"
        >
          + Pipeline
        </button>

        <div className="flex-1" />

        {/* view toggle */}
        <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded overflow-hidden">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-2.5 py-1 text-xs transition-colors ${viewMode === 'kanban' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            title="Kanban view"
          >
            ⬛ Board
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1 text-xs transition-colors ${viewMode === 'table' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            title="Table view"
          >
            ☰ Table
          </button>
        </div>

        {/* add contact */}
        {activePipeline && (
          <button
            onClick={() => setShowAddContact(true)}
            className="text-xs px-2.5 py-1 rounded bg-pink-600 hover:bg-pink-500 text-white transition-colors"
          >
            + Add Contact
          </button>
        )}
      </div>

      {/* content */}
      <div className="flex-1 overflow-auto p-3">
        {!activePipeline ? (
          <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">No pipelines found.</div>
        ) : viewMode === 'kanban' ? (
          <div className="flex gap-3 h-full">
            {stages.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                entries={entries.filter(e => e.stageId === stage.id)}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onCardClick={contactId => onContactSelect?.(contactId)}
              />
            ))}
            {stages.length === 0 && (
              <div className="flex items-center justify-center w-full text-zinc-500 text-sm">
                No stages in this pipeline yet.
              </div>
            )}
          </div>
        ) : (
          <TableView
            entries={entries}
            stages={stages}
            filterStageId={filterStageId}
            onFilterStage={setFilterStageId}
            onRowClick={contactId => onContactSelect?.(contactId)}
          />
        )}
      </div>

      {/* modals */}
      {showAddContact && activePipeline && (
        <AddContactModal
          pipelineId={activePipeline.id}
          stages={stages}
          onClose={() => setShowAddContact(false)}
          onAdded={() => activePipelineId && loadEntries(activePipelineId)}
        />
      )}
      {showNewPipeline && (
        <NewPipelineModal
          onClose={() => setShowNewPipeline(false)}
          onCreated={(id) => {
            loadPipelines().then(() => setActivePipelineId(id));
          }}
        />
      )}
    </div>
  );
}
