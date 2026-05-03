'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from './BoardClient';
import { GlobalSettingsModal } from './GlobalSettings';
import { useLocale } from '@/contexts/LocaleContext';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const APP_VERSION: string = (require('../../package.json') as { version: string }).version;

const WORKSPACE_BASE = '~/am/workspaces';

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function VersionBadge() {
  return (
    <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800 border border-white/5 px-1.5 py-0.5 rounded select-none">
      v{APP_VERSION}
    </span>
  );
}

function SettingsModal({ project, onClose, onUpdate, onDelete, onOpenGlobal }: {
  project: Project;
  onClose: () => void;
  onUpdate: (p: Project) => void;
  onDelete: () => void;
  onOpenGlobal: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState(project.name);
  const [currentVersion, setCurrentVersion] = useState(project.currentVersion ?? '0.0.1');
  const [isTest, setIsTest] = useState(project.isTest);
  const [githubRepo, setGithubRepo] = useState(project.githubRepo ?? '');
  const [vercelUrl, setVercelUrl] = useState(project.vercelUrl ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [exportMsg, setExportMsg] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

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
      const body: Record<string, unknown> = { name: name.trim(), isTest };
      body.repoDir = repoDir;
      if (currentVersion.trim()) body.currentVersion = currentVersion.trim();
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
      onDelete();
    } catch {
      setError(t('networkErrorShort'));
    } finally {
      setDeleting(false);
    }
  }

  function handleExport() {
    const a = document.createElement('a');
    a.href = `/api/projects/${project.id}/export`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setExportMsg('Download started');
    setTimeout(() => setExportMsg(''), 2000);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportMsg('Importing…');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/projects/${project.id}/import`, { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setImportMsg(`Error: ${body.error ?? res.statusText}`);
      } else {
        setImportMsg('Import successful');
      }
    } catch {
      setImportMsg('Import failed — network error');
    }
    setTimeout(() => setImportMsg(''), 3000);
  }

  const isDirty = name.trim() !== project.name || isTest !== project.isTest
    || githubRepo.trim() !== (project.githubRepo ?? '') || vercelUrl.trim() !== (project.vercelUrl ?? '')
    || currentVersion.trim() !== (project.currentVersion ?? '');

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="project-settings-title" className="relative w-full max-w-xs sm:max-w-md bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span id="project-settings-title" className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">{t('projectSettings')}</span>
            <VersionBadge />
          </div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ps-field-name" className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('displayName')}</label>
            <input
              id="ps-field-name"
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
              checked={isTest}
              onChange={e => setIsTest(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-zinc-800 text-pink-500 focus:ring-pink-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-zinc-300">{t('testProject')}</span>
            <span className="text-xs text-zinc-600">{t('testProjectHint')}</span>
          </label>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ps-field-version" className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('currentVersionLabel')}</label>
            <input
              id="ps-field-version"
              type="text"
              value={currentVersion}
              onChange={e => setCurrentVersion(e.target.value)}
              placeholder="0.0.1"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>

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
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('liveUrlLabel')}</label>
              <input
                type="url"
                value={vercelUrl}
                onChange={e => setVercelUrl(e.target.value)}
                placeholder="https://yourapp.com"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          {/* Export / Import */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={handleExport}
              className="text-xs px-2.5 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="text-xs px-2.5 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              Import
            </button>
            <input ref={importInputRef} type="file" accept=".zip" className="hidden" onChange={handleImport} />
            {exportMsg && <span className="text-xs text-emerald-400">{exportMsg}</span>}
            {importMsg && <span className={`text-xs ${importMsg.startsWith('Error') || importMsg.startsWith('Import failed') ? 'text-red-400' : 'text-emerald-400'}`}>{importMsg}</span>}
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
              <div className="flex items-center gap-3">
                <button type="button" onClick={onOpenGlobal} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  {t('globalSettings')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={submitting}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  {t('deleteProject')}
                </button>
              </div>
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
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

const AM_BOARD_WORKSPACE = 'workspaces/am-board';

function AmBoardSettingsModal({ onClose, onOpenGlobal }: { onClose: () => void; onOpenGlobal: () => void }) {
  const { t } = useLocale();
  const [version, setVersion] = useState<string>('…');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    fetch('/api/version')
      .then((r) => r.json())
      .then((data: { version: string }) => setVersion(data.version))
      .catch(() => setVersion('unknown'));
  }, []);

  const field = (label: string, value: string) => (
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

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xs sm:max-w-md bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">AM</span>
            <span className="text-[10px] font-medium tracking-wide text-zinc-600 bg-zinc-800 border border-white/5 px-2 py-0.5 rounded uppercase">{t('rootProject')}</span>
            <VersionBadge />
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {field(t('displayName'), 'AM')}
          {field(t('slug'), 'am-board')}
          {field('Project Type', 'Software Development')}
          {field(t('workspace'), AM_BOARD_WORKSPACE)}
          {field(t('version'), version)}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-zinc-600">docs · media · notes live inside the repo root, gitignored</p>
            <p className="text-xs text-zinc-700">The repo root is the project — these settings are fixed.</p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={onOpenGlobal} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              {t('globalSettings')}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">{t('close')}</button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function ProjectSettings({ project, onProjectUpdated, onProjectDeleted }: {
  project: Project | null;
  onProjectUpdated: (p: Project) => void;
  onProjectDeleted?: (id: string) => void;
}) {
  const { t } = useLocale();
  const [showModal, setShowModal] = useState(false);
  const [showGlobal, setShowGlobal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title={t('projectSettings')}
        className="flex items-center justify-center px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>

      {showModal && !project && (
        <AmBoardSettingsModal onClose={() => setShowModal(false)} onOpenGlobal={() => { setShowModal(false); setShowGlobal(true); }} />
      )}
      {showModal && project && (
        <SettingsModal
          project={project}
          onClose={() => setShowModal(false)}
          onUpdate={(p) => { onProjectUpdated(p); setShowModal(false); }}
          onDelete={() => { setShowModal(false); onProjectDeleted?.(project.id); }}
          onOpenGlobal={() => { setShowModal(false); setShowGlobal(true); }}
        />
      )}
      {showGlobal && <GlobalSettingsModal onClose={() => setShowGlobal(false)} />}
    </>
  );
}
