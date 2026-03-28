'use client';

import { NewCardForm } from './NewCardForm';
import { ProjectSelector } from './ProjectSelector';
import { useLocale } from '@/contexts/LocaleContext';
import type { Project } from '@/contexts/ProjectsContext';

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

interface NavigationProps {
  activeCount: number;
  projectTokens: { in: number; out: number };
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  showMilestonePlanner: boolean;
  openMilestonePlanner: () => void;
  closeMilestonePlanner: () => void;
  showChat: boolean;
  chatUnread: boolean;
  openChat: () => void;
  closeChat: () => void;
  showNewForm: boolean;
  openNewCard: () => void;
  closeNewCard: () => void;
  selectedProjectId: string;
  projects: Project[];
  handleProjectSelect: (id: string) => void;
  switchProject: (id: string) => void;
  openSettings: () => void;
}

export function Navigation({
  activeCount,
  projectTokens,
  showSearch,
  setShowSearch,
  showMilestonePlanner,
  openMilestonePlanner,
  closeMilestonePlanner,
  showChat,
  chatUnread,
  openChat,
  closeChat,
  showNewForm,
  openNewCard,
  closeNewCard,
  selectedProjectId,
  projects,
  handleProjectSelect,
  switchProject,
  openSettings,
}: NavigationProps) {
  const { t } = useLocale();

  return (
    <header className="shrink-0 px-3 sm:px-6 py-3 sm:py-4 border-b border-border bg-surface/80 backdrop-blur-sm relative z-50">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <h1 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight shrink-0">{t('amBoard')}</h1>
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
          {/* Search panel */}
          <button
            onClick={() => setShowSearch(v => !v)}
            className={`shrink-0 text-sm px-2 py-1.5 rounded-lg transition-colors border ${showSearch ? 'bg-zinc-700 text-zinc-100 border-white/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
            title="Search cards"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </button>

          <button
            onClick={() => showMilestonePlanner ? closeMilestonePlanner() : openMilestonePlanner()}
            className={`shrink-0 text-sm px-2 py-1.5 rounded-lg transition-colors border ${showMilestonePlanner ? 'bg-sky-700/40 hover:bg-sky-700/60 text-sky-300 border-sky-500/50' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
            title={t('openRoadmap')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
          </button>
          <button
            onClick={() => { showChat ? closeChat() : openChat(); }}
            className={`relative shrink-0 text-sm px-2 py-1.5 rounded-lg transition-colors border ${chatUnread && !showChat ? 'bg-pink-700/40 hover:bg-pink-700/60 text-pink-300 border-pink-500/50' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
            title={t('openChat')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            {chatUnread && !showChat && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-pink-500 animate-pulse" />
            )}
          </button>
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
            onProjectCreated={() => {}}
          />
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
