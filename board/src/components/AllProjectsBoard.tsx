'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type CardState = 'backlog' | 'in-progress' | 'in-review' | 'shipped';

interface Card {
  id: string;
  projectId: string | null;
  state: CardState;
  workDir: string | null;
  archived: boolean;
}

interface Project {
  id: string;
  name: string;
}

interface ProjectRow {
  id: string | null;
  name: string;
  counts: Record<CardState, number>;
  activeCount: number;
}

const STATES: CardState[] = ['backlog', 'in-progress', 'in-review', 'shipped'];

const STATE_LABELS: Record<CardState, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  shipped: 'Shipped',
};

const STATE_COLORS: Record<CardState, string> = {
  backlog: 'text-zinc-400',
  'in-progress': 'text-sky-400',
  'in-review': 'text-amber-400',
  shipped: 'text-emerald-400',
};

function buildRows(projects: Project[], cards: Card[]): ProjectRow[] {
  const active = cards.filter(c => !c.archived);

  // AM Board row (null projectId)
  const amCards = active.filter(c => c.projectId === null);
  const amRow: ProjectRow = {
    id: null,
    name: 'AM Board',
    counts: {
      backlog: amCards.filter(c => c.state === 'backlog').length,
      'in-progress': amCards.filter(c => c.state === 'in-progress').length,
      'in-review': amCards.filter(c => c.state === 'in-review').length,
      shipped: amCards.filter(c => c.state === 'shipped').length,
    },
    activeCount: amCards.filter(c => c.workDir).length,
  };

  // Project rows
  const projectRows: ProjectRow[] = projects.map(p => {
    const pc = active.filter(c => c.projectId === p.id);
    return {
      id: p.id,
      name: p.name,
      counts: {
        backlog: pc.filter(c => c.state === 'backlog').length,
        'in-progress': pc.filter(c => c.state === 'in-progress').length,
        'in-review': pc.filter(c => c.state === 'in-review').length,
        shipped: pc.filter(c => c.state === 'shipped').length,
      },
      activeCount: pc.filter(c => c.workDir).length,
    };
  });

  return [amRow, ...projectRows];
}

function ProjectCard({ row, onClick }: { row: ProjectRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left p-4 rounded-xl border border-white/10 bg-zinc-900 hover:bg-zinc-800 hover:border-white/20 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-3">
        {row.activeCount > 0 && (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        )}
        <h2 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
          {row.name}
        </h2>
        {row.id === null && (
          <span className="ml-auto text-xs text-zinc-500 shrink-0">AM Board</span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {STATES.map(s => (
          <div key={s} className="flex flex-col items-center py-1.5 px-1 rounded-lg bg-zinc-800/60">
            <span className={`text-lg font-bold tabular-nums leading-none ${STATE_COLORS[s]}`}>
              {row.counts[s]}
            </span>
            <span className="text-[10px] text-zinc-500 mt-1 leading-none text-center">
              {STATE_LABELS[s]}
            </span>
          </div>
        ))}
      </div>
      {row.activeCount > 0 && (
        <p className="mt-2 text-xs text-emerald-400/80">
          {row.activeCount} active{row.activeCount === 1 ? '' : ''}
        </p>
      )}
    </button>
  );
}

interface AllProjectsBoardProps {
  initialProjects: Project[];
  initialCards: Card[];
}

export function AllProjectsBoard({ initialProjects, initialCards }: AllProjectsBoardProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [cards, setCards] = useState<Card[]>(initialCards);

  const refresh = useCallback(async () => {
    try {
      const [projRes, cardsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/cards'),
      ]);
      if (projRes.ok) setProjects(await projRes.json());
      if (cardsRes.ok) setCards(await cardsRes.json());
    } catch {}
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const rows = buildRows(projects, cards);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-zinc-100">All Projects</h1>
          <span className="text-sm text-zinc-500">{rows.length} boards</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(row => (
            <ProjectCard
              key={row.id ?? '__am__'}
              row={row}
              onClick={() => router.push(row.id ? `/p/${row.id}` : '/')}
            />
          ))}
        </div>
        {rows.length === 0 && (
          <p className="text-center text-zinc-500 mt-16">No projects yet.</p>
        )}
      </div>
    </div>
  );
}
