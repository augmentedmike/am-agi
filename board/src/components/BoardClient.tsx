'use client';

import { useState, useCallback } from 'react';
import { CardColumn } from './CardColumn';
import { CardPanel } from './CardPanel';
import { ChatPanel } from './ChatPanel';
import { SearchPanel } from './SearchPanel';
import { StatsPanel } from './StatsPanel';
import { TeamPanel } from './TeamPanel';
import { MilestonePlannerPanel } from './MilestonePlannerPanel';
import { NewCardForm } from './NewCardForm';
import { ProjectSelector } from './ProjectSelector';
import { ProjectSettings } from './ProjectSettings';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useProjects } from '@/contexts/ProjectsContext';
import { useBoardData, BoardDataProvider } from '@/contexts/BoardDataContext';
import { useCardPanel, CardPanelProvider, type Card } from '@/contexts/CardPanelContext';
import { useChat, ChatProvider } from '@/contexts/ChatContext';
import { useNewCard, NewCardProvider } from '@/contexts/NewCardContext';
import { useTeamPanel, TeamPanelProvider } from '@/contexts/TeamPanelContext';
import { useMilestonePlanner, MilestonePlannerProvider } from '@/contexts/MilestonePlannerContext';
import { useLocale } from '@/contexts/LocaleContext';

// Re-export types used by other components that import from BoardClient
export type { Card } from '@/contexts/CardPanelContext';
export type { Project } from '@/contexts/ProjectsContext';

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function BoardInner() {
  const { projects, selectedProjectId, switchProject } = useProjects();
  const { cards, celebratingIds, setCards } = useBoardData();
  const { selectedCard, openCard, closeCard } = useCardPanel();
  const { showChat, chatUnread, openChat, closeChat } = useChat();
  const { showNewForm, openNewCard, closeNewCard } = useNewCard();
  const { showTeam, openTeam, closeTeam } = useTeamPanel();
  const { showMilestonePlanner, openMilestonePlanner, closeMilestonePlanner } = useMilestonePlanner();
  const { t } = useLocale();

  const [scrollToIterationId, setScrollToIterationId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const activeCount = cards.filter(c => !!c.workDir && c.state !== 'shipped').length;

  const projectTokens = cards.reduce((acc, c) => {
    for (const tok of c.tokenLogs ?? []) {
      acc.in += tok.inputTokens;
      acc.out += tok.outputTokens;
    }
    return acc;
  }, { in: 0, out: 0 });

  const handleIterationOpen = useCallback(async (iterationId: string) => {
    try {
      const res = await fetch(`/api/iterations/${iterationId}`);
      if (!res.ok) return;
      const iter = await res.json();
      const card = cards.find(c => c.id === iter.cardId);
      if (card) {
        openCard(card);
        closeChat();
        setScrollToIterationId(iterationId);
      } else {
        // Card not in current view — fetch it
        const cardRes = await fetch(`/api/cards/${iter.cardId}`);
        if (!cardRes.ok) return;
        const fetchedCard: Card = await cardRes.json();
        openCard(fetchedCard);
        closeChat();
        setScrollToIterationId(iterationId);
      }
    } catch {}
  }, [cards, openCard, closeChat]);

  const handleProjectSelect = useCallback((id: string | null) => {
    switchProject(id);
  }, [switchProject]);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-zinc-950">
      <header className="shrink-0 px-6 py-4 border-b border-white/5 bg-zinc-900/80 backdrop-blur-sm relative z-50">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight shrink-0">{t('title')}</h1>
          <div className="flex items-center gap-3 shrink-0">
            {activeCount > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
            <span className="text-sm text-zinc-400">
              {activeCount} active
            </span>
            {(projectTokens.in + projectTokens.out) > 0 && (
              <span
                className="text-xs text-zinc-600 font-mono tabular-nums"
                title={`in: ${projectTokens.in.toLocaleString()} / out: ${projectTokens.out.toLocaleString()} / total: ${(projectTokens.in + projectTokens.out).toLocaleString()}`}
              >
                {fmtTokens(projectTokens.in)}↑ {fmtTokens(projectTokens.out)}↓
              </span>
            )}
            {/* Search panel */}
            <button
              onClick={() => setShowSearch(v => !v)}
              className={`text-sm px-2 py-1.5 rounded-lg transition-colors border ${showSearch ? 'bg-zinc-700 text-zinc-100 border-white/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
              title="Search cards"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </button>
            {/* Stats panel */}
            <button
              onClick={() => setShowStats(v => !v)}
              className={`text-sm px-2 py-1.5 rounded-lg transition-colors border ${showStats ? 'bg-zinc-700 text-zinc-100 border-white/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
              title="Stats"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </button>
            <LanguageSwitcher />
            <button
              onClick={() => showTeam ? closeTeam() : openTeam()}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors border ${showTeam ? 'bg-zinc-700 text-zinc-100 border-white/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
              title={t('teamButton')}
            >
              {t('teamButton')}
            </button>
            <button
              onClick={() => showMilestonePlanner ? closeMilestonePlanner() : openMilestonePlanner()}
              className={`text-sm px-2 py-1.5 rounded-lg transition-colors border ${showMilestonePlanner ? 'bg-sky-700/40 hover:bg-sky-700/60 text-sky-300 border-sky-500/50' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
              title={t('openRoadmap')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </button>
            <button
              onClick={() => { showChat ? closeChat() : openChat(); }}
              className={`relative text-sm px-2 py-1.5 rounded-lg transition-colors border ${chatUnread && !showChat ? 'bg-pink-700/40 hover:bg-pink-700/60 text-pink-300 border-pink-500/50' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
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
              className="text-sm px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-white font-medium transition-colors"
            >
              {t('newButton')}
            </button>
            <ProjectSelector
              selectedId={selectedProjectId}
              onSelect={handleProjectSelect}
              projects={projects}
              onProjectCreated={() => {}}
            />
            <ProjectSettings
              project={projects.find(p => p.id === selectedProjectId) ?? null}
              onProjectUpdated={() => {}}
              onProjectDeleted={() => switchProject(null)}
            />
          </div>
        </div>
        {showNewForm && (
          <NewCardForm projectId={selectedProjectId} onClose={closeNewCard} />
        )}
      </header>

      <div className="flex-1 flex flex-row overflow-hidden">
        {STATES.map(state => (
          <CardColumn
            key={state}
            state={state}
            cards={cards.filter(c => c.state === state)}
            onCardClick={openCard}
            celebratingIds={celebratingIds}
          />
        ))}
      </div>

      {/* Footer with language switcher */}
      <footer className="shrink-0 px-6 py-2 border-t border-white/5 bg-zinc-900/60 flex items-center justify-end">
        <LanguageSwitcher />
      </footer>

      <CardPanel
        card={selectedCard}
        onClose={closeCard}
        scrollToIterationId={scrollToIterationId}
        onCardUpdate={(updated) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((updated as any).archived) {
            setCards(prev => prev.filter(c => c.id !== updated.id));
          } else {
            setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
          }
        }}
      />
      <ChatPanel
        open={showChat}
        onClose={closeChat}
        onCardOpen={(cardId) => {
          const card = cards.find(c => c.id === cardId);
          if (card) { openCard(card); closeChat(); }
        }}
        onIterationOpen={handleIterationOpen}
      />
      <SearchPanel
        open={showSearch}
        onClose={() => setShowSearch(false)}
        cards={cards}
        onCardClick={(card) => { openCard(card); setShowSearch(false); }}
      />
      <StatsPanel open={showStats} onClose={() => setShowStats(false)} cards={cards} />
      <TeamPanel open={showTeam} onClose={closeTeam} />
      <MilestonePlannerPanel
        open={showMilestonePlanner}
        projectId={selectedProjectId}
        projectName={projects.find(p => p.id === selectedProjectId)?.name ?? ''}
        onClose={closeMilestonePlanner}
      />
    </div>
  );
}

export function BoardClient({ initialCards, initialProjectId = null }: { initialCards: Card[]; initialProjectId?: string | null }) {
  void initialProjectId; // selectedProjectId comes from ProjectsContext (URL-derived)
  return (
    <BoardDataProvider initialCards={initialCards}>
      <CardPanelProvider>
        <ChatProvider>
          <NewCardProvider>
            <TeamPanelProvider>
              <MilestonePlannerProvider>
                <BoardInner />
              </MilestonePlannerProvider>
            </TeamPanelProvider>
          </NewCardProvider>
        </ChatProvider>
      </CardPanelProvider>
    </BoardDataProvider>
  );
}
