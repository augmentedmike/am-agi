'use client';

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { pinyin } from 'pinyin-pro';
import type { Project } from './BoardClient';
import { useLocale } from '@/contexts/LocaleContext';

const LS_KEY = 'am_show_test_projects';

const WORKSPACE_BASE = '~/am-agi/workspaces/repos';

// CJK Unified Ideographs + Extensions + Compatibility
const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF\u{20000}-\u{2A6DF}]/u;

function slugify(name: string): string {
  // Transliterate CJK characters to pinyin before slugifying
  const ascii = CJK_RE.test(name)
    ? pinyin(name, { toneType: 'none', separator: ' ', nonZh: 'consecutive' })
    : name;
  return ascii
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip combining accents (é→e etc.)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function CreateProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Project) => void }) {
  const { t } = useLocale();
  const [name, setName] = useState('');
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
    if (!name.trim()) { setError(t('nameRequired')); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), repoDir }),
      });
      if (!res.ok) { setError(t('failedToCreate')); return; }
      onCreate(await res.json());
    } catch {
      setError(t('networkErrorShort'));
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xs sm:max-w-md bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">{t('newProject')}</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('name')}</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder={t('myProject')}
              autoFocus
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('workDirectory')}</label>
            <div className="bg-zinc-800/50 border border-white/5 rounded-lg px-3 py-2 font-mono text-sm text-zinc-500 select-all">
              {repoDir || <span className="text-zinc-700">~/am-agi/workspaces/repos/project-name</span>}
            </div>
            <p className="text-xs text-zinc-600">Auto-generated from project name — created on first agent run</p>
          </div>

          {error && (
            <div className="text-sm text-red-300 bg-red-900/30 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !slug}
              className="px-4 py-2 text-sm font-medium bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {submitting ? t('creating') : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

interface ProjectSelectorProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  projects: Project[];
  onProjectCreated: (p: Project) => void;
}

export function ProjectSelector({ selectedId, onSelect, projects, onProjectCreated }: ProjectSelectorProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAmBoard, setShowAmBoard] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, string>) => setShowAmBoard(s.show_am_board === 'true'))
      .catch(() => {});
  }, []);

  const handleToggle = useCallback(() => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(v => !v);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inButton = buttonRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inButton && !inDropdown) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Never show test projects
  const visibleProjects = projects.filter(p => !p.isTest);

  const selected = projects.find(p => p.id === selectedId);

  const dropdown = open && dropdownPos ? createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
      className="w-56 bg-zinc-800 border border-white/10 rounded-lg shadow-xl py-1 overflow-hidden"
    >
      {/* AM Board entry — only shown when show_am_board setting is true */}
      {showAmBoard && (
        <button
          onClick={() => { onSelect(null); setOpen(false); }}
          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${selectedId === null ? 'bg-pink-500/10 text-pink-300' : 'text-zinc-200 hover:bg-zinc-700/60'}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" style={{ opacity: selectedId === null ? 1 : 0 }} />
          AM Board
        </button>
      )}

      {/* All projects view */}
      <button
        onClick={() => { setOpen(false); router.push('/all'); }}
        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        All projects
      </button>

      {showAmBoard && visibleProjects.length > 0 && <div className="h-px bg-white/5 my-1" />}

      {visibleProjects.map(p => (
        <button
          key={p.id}
          onClick={() => { onSelect(p.id); setOpen(false); }}
          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${selectedId === p.id ? 'bg-pink-500/10 text-pink-300' : 'text-zinc-200 hover:bg-zinc-700/60'}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" style={{ opacity: selectedId === p.id ? 1 : 0 }} />
          <span className="truncate flex-1">{p.name}</span>
        </button>
      ))}

      <div className="h-px bg-white/5 my-1" />

      <button
        onClick={() => { setOpen(false); setShowCreate(true); }}
        className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60 transition-colors flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {t('createNewProject')}
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 hover:border-white/20 text-zinc-300 transition-colors"
        >
          {/* Grid icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span className="max-w-[min(120px,30vw)] truncate">{selected?.name ?? 'AM Board'}</span>
          <svg className={`h-3 w-3 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {dropdown}
      </div>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={(p) => {
            onProjectCreated(p);
            onSelect(p.id);
            setShowCreate(false);
          }}
        />
      )}
    </>
  );
}
