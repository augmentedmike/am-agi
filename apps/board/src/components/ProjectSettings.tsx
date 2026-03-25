'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from './BoardClient';

const WORKSPACE_BASE = '~/am-agi/workspaces/repos';

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function SettingsModal({ project, onClose, onUpdate }: {
  project: Project;
  onClose: () => void;
  onUpdate: (p: Project) => void;
}) {
  const [name, setName] = useState(project.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const slug = slugify(name);
  const repoDir = slug ? `${WORKSPACE_BASE}/${slug}` : '';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), repoDir }),
      });
      if (!res.ok) { setError('Failed to save.'); return; }
      onUpdate(await res.json());
      onClose();
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Project Settings</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              autoFocus
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Slug</label>
            <div className="bg-zinc-800/50 border border-white/5 rounded-lg px-3 py-2 font-mono text-sm text-zinc-500 select-all">
              {slug || <span className="text-zinc-700">—</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Work Directory</label>
            <div className="bg-zinc-800/50 border border-white/5 rounded-lg px-3 py-2 font-mono text-sm text-zinc-500 select-all">
              {repoDir || <span className="text-zinc-700">—</span>}
            </div>
            <p className="text-xs text-zinc-600">Auto-generated — created on first agent run</p>
          </div>

          {error && (
            <div className="text-sm text-red-300 bg-red-900/30 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !slug || name.trim() === project.name}
              className="px-4 py-2 text-sm font-medium bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function ProjectSettings({ project, onProjectUpdated }: { project: Project | null; onProjectUpdated: (p: Project) => void }) {
  const [showModal, setShowModal] = useState(false);

  if (!project) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title="Project settings"
        className="flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>

      {showModal && (
        <SettingsModal
          project={project}
          onClose={() => setShowModal(false)}
          onUpdate={(p) => { onProjectUpdated(p); setShowModal(false); }}
        />
      )}
    </>
  );
}
