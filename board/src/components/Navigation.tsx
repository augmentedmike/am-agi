'use client';

import { useState, useEffect } from 'react';
import { NewCardForm } from './NewCardForm';
import { ProjectSelector } from './ProjectSelector';
import { useLocale } from '@/contexts/LocaleContext';
import type { Project } from '@/contexts/ProjectsContext';

function semverDesc(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [a0, a1, a2] = parse(a);
  const [b0, b1, b2] = parse(b);
  return a0 !== b0 ? b0 - a0 : a1 !== b1 ? b1 - a1 : b2 - a2;
}

function VersionBadge({ project }: { project: Project }) {
  const [versions, setVersions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project.versioned) return;
    fetch(`/api/projects/${project.id}/versions`)
      .then(r => r.json())
      .then((data: { versions: string[]; currentVersion: string | null }) => {
        const sorted = [...data.versions].sort(semverDesc);
        setVersions(sorted);
      })
      .catch(() => {});
  }, [project.id, project.versioned, project.currentVersion]);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (!v || v === project.currentVersion) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentVersion: v }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (!project.versioned) return null;

  const options = versions.length > 0 ? versions : (project.currentVersion ? [project.currentVersion] : []);

  return (
    <select
      value={project.currentVersion ?? ''}
      onChange={handleChange}
      disabled={saving || options.length === 0}
      title="Current version"
      className="shrink-0 text-xs font-mono text-violet-400 bg-violet-500/10 border border-violet-500/25 hover:border-violet-400/60 hover:text-violet-300 rounded-lg px-2 py-1.5 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
    >
      {options.length === 0 && <option value="">no versions</option>}
      {options.map(v => (
        <option key={v} value={v} className="bg-zinc-900 text-zinc-100">{v}</option>
      ))}
    </select>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

interface NavigationProps {
  activeCount: number;
  projectTokens: { in: number; out: number };
  showNewForm: boolean;
  openNewCard: () => void;
  closeNewCard: () => void;
  selectedProjectId: string;
  projects: Project[];
  handleProjectSelect: (id: string) => void;
  switchProject: (id: string) => void;
  onProjectCreated: (p: Project) => void;
  openSettings: () => void;
}

export function Navigation({
  activeCount,
  projectTokens,
  showNewForm,
  openNewCard,
  closeNewCard,
  selectedProjectId,
  projects,
  handleProjectSelect,
  switchProject,
  onProjectCreated,
  openSettings,
}: NavigationProps) {
  const { t } = useLocale();

  return (
    <header className="shrink-0 px-3 sm:px-6 py-2 sm:py-2.5 border-b border-border bg-surface/80 backdrop-blur-sm relative z-50">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
        <h1 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight shrink-0">
          {t('amBoard')}
        </h1>
        <p className="hidden sm:block text-center text-sm font-medium text-zinc-200 truncate">
          {t('amTagline')}
        </p>
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 overflow-x-auto scrollbar-hide">
          {activeCount > 0 && (
            <span className="hidden sm:flex relative h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          )}
          <span className="hidden sm:inline text-sm text-zinc-400 shrink-0">
            {activeCount} active
          </span>
          {(projectTokens.in + projectTokens.out) > 0 && (
            <span
              className="hidden sm:inline text-xs text-zinc-600 font-mono tabular-nums shrink-0"
              title={`in: ${projectTokens.in.toLocaleString()} / out: ${projectTokens.out.toLocaleString()} / total: ${(projectTokens.in + projectTokens.out).toLocaleString()}`}
            >
              {fmtTokens(projectTokens.in)}↑ {fmtTokens(projectTokens.out)}↓
            </span>
          )}
          <button
            onClick={() => showNewForm ? closeNewCard() : openNewCard()}
            className="shrink-0 text-sm px-2 sm:px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-white font-medium transition-colors"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">{t('newButton')}</span>
          </button>
          <ProjectSelector
            selectedId={selectedProjectId}
            onSelect={handleProjectSelect}
            projects={projects}
            onProjectCreated={onProjectCreated}
            onOpenProjectSettings={(id) => { switchProject(id); openSettings(); }}
          />
          {(() => {
            const p = projects.find(x => x.id === selectedProjectId);
            return p?.versioned ? <VersionBadge key={p.id} project={p} /> : null;
          })()}
          <button
            onClick={openSettings}
            title={t('projectSettings')}
            className="flex items-center justify-center px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </div>
      </div>
      {showNewForm && (
        <NewCardForm projectId={selectedProjectId} onClose={closeNewCard} />
      )}
    </header>
  );
}
