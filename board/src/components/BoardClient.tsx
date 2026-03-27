'use client';

import { useState, useCallback } from 'react';
import { CardColumn } from './CardColumn';
import { CardPanel } from './CardPanel';
import { ChatPanel } from './ChatPanel';
import { SearchPanel } from './SearchPanel';
import { StatsPanel } from './StatsPanel';
import { TeamPanel } from './TeamPanel';
import { MilestonePlannerPanel } from './MilestonePlannerPanel';
import { Navigation } from './Navigation';
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
  const [mobileActiveColumn, setMobileActiveColumn] = useState<string>('backlog');

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
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <Navigation
        activeCount={activeCount}
        projectTokens={projectTokens}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        showStats={showStats}
        setShowStats={setShowStats}
        showMilestonePlanner={showMilestonePlanner}
        openMilestonePlanner={openMilestonePlanner}
        closeMilestonePlanner={closeMilestonePlanner}
        showChat={showChat}
        chatUnread={chatUnread}
        openChat={openChat}
        closeChat={closeChat}
        showNewForm={showNewForm}
        openNewCard={openNewCard}
        closeNewCard={closeNewCard}
        selectedProjectId={selectedProjectId}
        projects={projects}
        handleProjectSelect={handleProjectSelect}
        switchProject={switchProject}
      />

      <div className="flex-1 flex flex-row overflow-hidden">
        {STATES.map(state => {
          const stateCards = cards.filter(c => c.state === state);
          const mobileColumnOptions = STATES.map(s => ({
            state: s,
            label: s === 'backlog' ? t('backlog') : s === 'in-progress' ? t('inProgress') : s === 'in-review' ? t('inReview') : t('shipped'),
            count: cards.filter(c => c.state === s).length,
          }));
          return (
            <CardColumn
              key={state}
              state={state}
              cards={stateCards}
              onCardClick={openCard}
              celebratingIds={celebratingIds}
              isMobileActive={mobileActiveColumn === state}
              onMobileHeaderClick={() => {}}
              mobileColumnOptions={mobileColumnOptions}
              onMobileColumnSelect={setMobileActiveColumn}
            />
          );
        })}
      </div>

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
