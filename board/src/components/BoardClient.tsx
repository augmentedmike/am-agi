'use client';

import { useState, useCallback, useEffect } from 'react';
import { AM_BOARD_PROJECT_ID, CONTENT_TEMPLATE_TYPES } from '@/lib/constants';
import { CardColumn } from './CardColumn';
import { CardPanel } from './CardPanel';
import { ChatPanel } from './ChatPanel';
import { SearchPanel } from './SearchPanel';
import { CalendarPanel } from './CalendarPanel';

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
import { useCalendar, CalendarProvider } from '@/contexts/CalendarContext';
import { useLocale } from '@/contexts/LocaleContext';
import { OnboardingWizard } from './OnboardingWizard';
import { BoardFooter } from './BoardFooter';
import { MobileModalStackProvider, useMobileModalStack } from '@/contexts/MobileModalStackContext';

// Re-export types used by other components that import from BoardClient
export type { Card } from '@/contexts/CardPanelContext';
export type { Project } from '@/contexts/ProjectsContext';

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

function BoardInner() {
  const { projects, selectedProjectId, switchProject, addProject } = useProjects();
  const { cards, celebratingIds, setCards } = useBoardData();
  const { selectedCard, openCard, closeCard } = useCardPanel();
  const { showChat, chatUnread, openChat, closeChat } = useChat();
  const [chatAttention, setChatAttention] = useState(false);
  const { showNewForm, openNewCard, closeNewCard } = useNewCard();
  const { showTeam, openTeam, closeTeam } = useTeamPanel();
  const { showMilestonePlanner, openMilestonePlanner, closeMilestonePlanner } = useMilestonePlanner();
  const { showCalendar, openCalendar, closeCalendar } = useCalendar();
  const { t } = useLocale();
  const { push: pushModal, pop: popModal, remove: removeModal } = useMobileModalStack();

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
  const isCalendarProject = !!(selectedProject?.templateType && CONTENT_TEMPLATE_TYPES.has(selectedProject.templateType));

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

  // Periodically pulse the chat icon to draw attention when chat is closed
  useEffect(() => {
    if (showChat) return;
    const timer = setInterval(() => {
      setChatAttention(true);
      setTimeout(() => setChatAttention(false), 1200);
    }, 20000 + Math.random() * 10000);
    return () => clearInterval(timer);
  }, [showChat]);

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
        openSettings={() => { setShowSettings(true); pushModal('settings'); }}
        openChat={() => { openChat(); pushModal('chat'); }}
        openSearch={() => { setShowSearch(true); pushModal('search'); }}
      />

      <div className="flex-1 flex flex-row overflow-hidden">
        <LeftToolbar
          showSearch={showSearch}
          setShowSearch={(v) => {
            const next = typeof v === 'function' ? v(showSearch) : v;
            setShowSearch(next);
            if (next) pushModal('search'); else removeModal('search');
          }}
          showMilestonePlanner={showMilestonePlanner}
          openMilestonePlanner={() => { openMilestonePlanner(); pushModal('milestone'); }}
          closeMilestonePlanner={() => { closeMilestonePlanner(); removeModal('milestone'); }}
          showChat={showChat}
          chatUnread={chatUnread}
          chatAttention={chatAttention}
          openChat={() => { openChat(); pushModal('chat'); }}
          closeChat={() => { closeChat(); removeModal('chat'); }}
          hasGit={hasGit}
          showGit={showGit}
          openGit={() => { setShowGit(true); pushModal('file-viewer'); }}
          closeGit={() => { setShowGit(false); removeModal('file-viewer'); }}
          hasEmail={hasEmail}
          showEmail={showEmail}
          openEmail={() => setShowEmail(true)}
          closeEmail={() => setShowEmail(false)}
          showFolder={showFolder}
          openFolder={() => { setShowFolder(true); pushModal('file-viewer'); }}
          closeFolder={() => { setShowFolder(false); removeModal('file-viewer'); }}
          openSettings={() => { setShowSettings(true); pushModal('settings'); }}
          isCalendarProject={isCalendarProject}
          showCalendar={showCalendar}
          openCalendar={openCalendar}
          closeCalendar={closeCalendar}
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
              onCardClick={(card) => { openCard(card); pushModal('card'); }}
              celebratingIds={celebratingIds}
              isMobileActive={mobileActiveColumn === state}
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
        onClose={() => { closeCard(); removeModal('card'); }}
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
        onClose={() => { closeChat(); removeModal('chat'); }}
        onCardOpen={(cardId) => {
          const card = cards.find(c => c.id === cardId);
          if (card) { openCard(card); pushModal('card'); closeChat(); removeModal('chat'); }
        }}
        onIterationOpen={handleIterationOpen}
      />
      <SearchPanel
        open={showSearch}
        onClose={() => { setShowSearch(false); removeModal('search'); }}
        cards={cards}
        onCardClick={(card) => { openCard(card); pushModal('card'); setShowSearch(false); removeModal('search'); }}
      />
      <TeamPanel open={showTeam} onClose={closeTeam} />
      <MilestonePlannerPanel
        open={showMilestonePlanner}
        projectId={selectedProjectId}
        projectName={projects.find(p => p.id === selectedProjectId)?.name ?? ''}
        onClose={() => { closeMilestonePlanner(); removeModal('milestone'); }}
      />
      {isCalendarProject && (
        <CalendarPanel
          open={showCalendar}
          projectId={selectedProjectId}
          onClose={closeCalendar}
        />
      )}
      <SettingsPanel
        open={showSettings}
        onClose={() => { setShowSettings(false); removeModal('settings'); }}
        project={projects.find(p => p.id === selectedProjectId) ?? null}
        projects={projects}
        onProjectUpdated={(updated) => {
          setShowSettings(false);
          removeModal('settings');
          void updated;
        }}
        onProjectDeleted={(id) => {
          setShowSettings(false);
          removeModal('settings');
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
        onClose={() => { setShowFolder(false); setShowGit(false); removeModal('file-viewer'); }}
        onModeChange={(m) => {
          setViewerMode(m);
          if (m === 'git') { setShowGit(true); setShowFolder(true); }
        }}
        onFileSelect={(p) => { setViewerFile(p); setViewerMode('file'); }}
      />
      <OnboardingWizard />
      <BoardFooter />
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
                <CalendarProvider>
                  <MobileModalStackProvider>
                    <BoardInner />
                  </MobileModalStackProvider>
                </CalendarProvider>
              </MilestonePlannerProvider>
            </TeamPanelProvider>
          </NewCardProvider>
        </ChatProvider>
      </CardPanelProvider>
    </BoardDataProvider>
  );
}
