'use client';

import { useState, useCallback, useEffect } from 'react';
import { AM_BOARD_PROJECT_ID } from '@/lib/constants';
import { CardColumn } from './CardColumn';
import { CardPanel } from './CardPanel';
import { ChatPanel } from './ChatPanel';
import { SearchPanel } from './SearchPanel';

import { TeamPanel } from './TeamPanel';
import { MilestonePlannerPanel } from './MilestonePlannerPanel';
import { SettingsPanel } from './SettingsPanel';
import { FileViewerPanel, type ViewerMode } from './FileViewerPanel';
import { Navigation } from './Navigation';
import { LeftToolbar } from './LeftToolbar';
import { useProjects } from '@/contexts/ProjectsContext';
import { useBoardData, BoardDataProvider } from '@/contexts/BoardDataContext';
import { useCardPanel, CardPanelProvider, type Card } from '@/contexts/CardPanelContext';
import { useChat, ChatProvider } from '@/contexts/ChatContext';
import { useNewCard, NewCardProvider } from '@/contexts/NewCardContext';
import { useTeamPanel, TeamPanelProvider } from '@/contexts/TeamPanelContext';
import { useMilestonePlanner, MilestonePlannerProvider } from '@/contexts/MilestonePlannerContext';
import { useLocale } from '@/contexts/LocaleContext';
import { OnboardingWizard } from './OnboardingWizard';

// Re-export types used by other components that import from BoardClient
export type { Card } from '@/contexts/CardPanelContext';
export type { Project } from '@/contexts/ProjectsContext';

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

function BoardInner() {
  const { projects, selectedProjectId, switchProject, addProject } = useProjects();
  const { cards, celebratingIds, setCards } = useBoardData();
  const { selectedCard, openCard, closeCard } = useCardPanel();
  const { showChat, chatUnread, openChat, closeChat } = useChat();
  const { showNewForm, openNewCard, closeNewCard } = useNewCard();
  const { showTeam, openTeam, closeTeam } = useTeamPanel();
  const { showMilestonePlanner, openMilestonePlanner, closeMilestonePlanner } = useMilestonePlanner();
  const { t } = useLocale();

  const [scrollToIterationId, setScrollToIterationId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileActiveColumn, setMobileActiveColumn] = useState<string>('backlog');
  const [showSettings, setShowSettings] = useState(false);
  const [showGit, setShowGit] = useState(false);
  const [showFolder, setShowFolder] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [viewerMode, setViewerMode] = useState<ViewerMode>('tree');
  const [viewerFile, setViewerFile] = useState<string | null>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null;
  const hasGit = !!(selectedProject?.repoDir || selectedProject?.githubRepo);

  useEffect(() => {
    function loadSettings() {
      fetch('/api/settings').then(r => r.json()).then((s: Record<string, string>) => {
        setHasEmail(!!(s.smtp_host));
        setAdvancedMode(s.advanced_mode === 'true');
      }).catch(() => {});
    }
    loadSettings();
    window.addEventListener('settings-changed', loadSettings);
    return () => window.removeEventListener('settings-changed', loadSettings);
  }, []);

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

  const handleProjectSelect = useCallback((id: string) => {
    switchProject(id);
  }, [switchProject]);

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-background">
      <Navigation
        totalCards={cards.length}
        activeCount={activeCount}
        projectTokens={projectTokens}
        showNewForm={showNewForm}
        openNewCard={openNewCard}
        closeNewCard={closeNewCard}
        selectedProjectId={selectedProjectId}
        projects={projects}
        handleProjectSelect={handleProjectSelect}
        switchProject={switchProject}
        onProjectCreated={(p) => { addProject(p); switchProject(p.id); }}
        openSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 flex flex-row overflow-hidden">
        <LeftToolbar
          showSearch={showSearch}
          setShowSearch={setShowSearch}
          showMilestonePlanner={showMilestonePlanner}
          openMilestonePlanner={openMilestonePlanner}
          closeMilestonePlanner={closeMilestonePlanner}
          showChat={showChat}
          chatUnread={chatUnread}
          openChat={openChat}
          closeChat={closeChat}
          hasGit={hasGit}
          showGit={showGit}
          openGit={() => setShowGit(true)}
          closeGit={() => setShowGit(false)}
          hasEmail={hasEmail}
          showEmail={showEmail}
          openEmail={() => setShowEmail(true)}
          closeEmail={() => setShowEmail(false)}
          showFolder={showFolder}
          openFolder={() => setShowFolder(true)}
          closeFolder={() => setShowFolder(false)}
          openSettings={() => setShowSettings(true)}
        />
        {STATES.map(state => {
          const stateCards = cards.filter(c => c.state === state);
          const tmpl = selectedProject?.templateType ?? null;
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
              templateType={tmpl}
              advancedMode={advancedMode}
              projectId={selectedProjectId ?? undefined}
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
      <TeamPanel open={showTeam} onClose={closeTeam} />
      <MilestonePlannerPanel
        open={showMilestonePlanner}
        projectId={selectedProjectId}
        projectName={projects.find(p => p.id === selectedProjectId)?.name ?? ''}
        onClose={closeMilestonePlanner}
      />
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        project={projects.find(p => p.id === selectedProjectId) ?? null}
        projects={projects}
        onProjectUpdated={(updated) => {
          // projects list is managed by ProjectsContext — trigger a refresh via page reload or just close
          setShowSettings(false);
          void updated;
        }}
        onProjectDeleted={(id) => {
          setShowSettings(false);
          switchProject(AM_BOARD_PROJECT_ID);
          void id;
        }}
      />
      <FileViewerPanel
        projectId={selectedProjectId}
        open={showFolder || showGit}
        standalone={true}
        mode={showGit && !showFolder ? 'git' : viewerMode}
        filePath={viewerFile}
        onClose={() => { setShowFolder(false); setShowGit(false); }}
        onModeChange={(m) => {
          setViewerMode(m);
          if (m === 'git') { setShowGit(true); setShowFolder(true); }
        }}
        onFileSelect={(p) => { setViewerFile(p); setViewerMode('file'); }}
      />
      <OnboardingWizard />
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
