'use client';

import { useState, useEffect, useRef } from 'react';
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
  totalCards: number;
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
  /** Mobile-only: open chat panel */
  openChat?: () => void;
  /** Mobile-only: open search panel */
  openSearch?: () => void;
}

export function Navigation({
  totalCards,
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
  openChat,
  openSearch,
}: NavigationProps) {
  const { t } = useLocale();
  const [wiggle, setWiggle] = useState(false);
  const wiggleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [taglineFade, setTaglineFade] = useState(true);

  const TAGLINES = [
    'The project management board that does its own work.',
    'Ship faster. AM handles the rest.',
    'Not just tracking work. Doing it.',
    'From backlog to shipped, automatically.',
    'The team that never sleeps.',
    'Plans, reviews, deploys — all in one place.',
    'Outreach, code, support — AM\'s got it.',
    'Kanban that actually closes tickets.',
    'Let the board work for you.',
    'Your board. Your agent. Your codebase.',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineFade(false);
      setTimeout(() => {
        setTaglineIdx(i => (i + 1) % TAGLINES.length);
        setTaglineFade(true);
      }, 500);
    }, 4500);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (totalCards > 0) return;
    function scheduleWiggle() {
      wiggleTimer.current = setTimeout(() => {
        setWiggle(true);
        setTimeout(() => setWiggle(false), 600);
        scheduleWiggle();
      }, 4000 + Math.random() * 4000);
    }
    scheduleWiggle();
    return () => { if (wiggleTimer.current) clearTimeout(wiggleTimer.current); };
  }, [totalCards]);

  return (
    <header className="shrink-0 px-3 sm:px-6 py-2 sm:py-2.5 border-b border-border bg-surface/80 backdrop-blur-sm relative z-50">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
        <h1 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight shrink-0">
          {t('amBoard')}
        </h1>
        <p
          className="hidden sm:block text-center text-sm font-medium text-zinc-400 truncate transition-opacity duration-500"
          style={{ opacity: taglineFade ? 1 : 0 }}
        >
          {TAGLINES[taglineIdx]}
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
            className={`shrink-0 text-sm px-2 sm:px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-white font-medium transition-colors ${wiggle ? 'animate-[wiggle_0.6s_ease-in-out]' : ''}`}
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
        </div>
      </div>
      {showNewForm && (
        <NewCardForm projectId={selectedProjectId} onClose={closeNewCard} />
      )}
    </header>
  );
}
