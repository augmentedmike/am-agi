'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CardColumn } from './CardColumn';
import { CardPanel } from './CardPanel';
import { ChatPanel } from './ChatPanel';
import { TeamPanel } from './TeamPanel';
import { MilestonePlannerPanel } from './MilestonePlannerPanel';
import { NewCardForm } from './NewCardForm';
import { ProjectSelector } from './ProjectSelector';
import { ProjectSettings } from './ProjectSettings';
import { useProjects } from '@/contexts/ProjectsContext';

type WorkLogEntry = { timestamp: string; message: string };
type Attachment = { path: string; name: string };
type TokenLogEntry = { iter: number; inputTokens: number; outputTokens: number; cacheRead: number; timestamp: string };

export type Project = {
  id: string;
  name: string;
  repoDir: string;
  createdAt: string;
  updatedAt: string;
};

export type Card = {
  id: string;
  title: string;
  state: 'backlog' | 'in-progress' | 'in-review' | 'shipped';
  priority: 'critical' | 'high' | 'normal' | 'low';
  attachments: Attachment[];
  workLog: WorkLogEntry[];
  tokenLogs: TokenLogEntry[];
  workDir: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  inProgressAt?: string;
  inReviewAt?: string;
  shippedAt?: string;
};

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

export function BoardClient({ initialCards, initialProjectId = null }: { initialCards: Card[]; initialProjectId?: string | null }) {
  const { projects, selectedProjectId, switchProject } = useProjects();
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  const [showMilestonePlanner, setShowMilestonePlanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  void initialProjectId; // selectedProjectId now comes from context (URL-derived)

  const searchResults = searchQuery.trim()
    ? cards.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
    : [];

  // Open card from ?card= URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get('card');
    if (cardId) {
      const card = initialCards.find(c => c.id === cardId);
      if (card) setSelectedCard(card);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync ?card=<id> in URL when selected card changes
  useEffect(() => {
    const base = window.location.pathname;
    if (selectedCard) {
      window.history.replaceState(null, '', `${base}?card=${selectedCard.id}`);
    } else {
      window.history.replaceState(null, '', base);
    }
  }, [selectedCard?.id]);

  const selectedProjectIdRef = useRef(selectedProjectId);
  const showChatRef = useRef(showChat);
  useEffect(() => { showChatRef.current = showChat; }, [showChat]);

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4201';
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function handleMessage(event: MessageEvent) {
      try {
        const ev = JSON.parse(event.data);
        const cardMatchesProject = (ev.card?.projectId ?? null) === selectedProjectIdRef.current;
        if (ev.type === 'card_created' && cardMatchesProject) {
          setCards(prev => {
            if (prev.some(c => c.id === ev.card.id)) return prev;
            return [...prev, ev.card];
          });
        } else if ((ev.type === 'card_moved' || ev.type === 'card_updated') && cardMatchesProject) {
          setCards(prev => prev.map(c => c.id === ev.card.id ? ev.card : c));
          setSelectedCard(prev => prev?.id === ev.card.id ? ev.card : prev);
          if (ev.type === 'card_moved' && ev.card.state === 'shipped') {
            const id = ev.card.id as string;
            setCelebratingIds(prev => new Set([...prev, id]));
            setTimeout(() => {
              setCelebratingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }, 4500);
          }
        } else if (ev.type === 'chat_message' || ev.type === 'chat_message_updated') {
          // New assistant message — flash icon if chat is closed
          if (!showChatRef.current && ev.message?.role === 'assistant' && ev.message?.status === 'done') {
            setChatUnread(true);
          }
        }
      } catch {}
    }

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = handleMessage;
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);


  // Polling fallback: refetch cards every 5 seconds
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const projectId = selectedProjectId ?? '';
        const res = await fetch(`/api/cards?projectId=${encodeURIComponent(projectId)}`);
        if (!res.ok) return;
        const fresh: Card[] = await res.json();
        setCards(fresh);
        setSelectedCard(prev => prev ? (fresh.find(c => c.id === prev.id) ?? null) : null);
      } catch {}
    }, 5_000);
    return () => clearInterval(id);
  }, [selectedProjectId]);

  const handleCardClick = useCallback((card: Card) => {
    setSelectedCard(card);
  }, []);

  const handleProjectSelect = useCallback((id: string | null) => {
    switchProject(id);
  }, [switchProject]);

  const handleClosePanel = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const activeCount = cards.filter(c => !!c.workDir && c.state !== 'shipped').length;

  const projectTokens = cards.reduce((acc, c) => {
    for (const t of c.tokenLogs ?? []) {
      acc.in += t.inputTokens;
      acc.out += t.outputTokens;
    }
    return acc;
  }, { in: 0, out: 0 });

  function fmtTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  }

  const handleSearchSelect = useCallback((card: Card) => {
    setSelectedCard(card);
    setSearchQuery('');
    setSearchOpen(false);
  }, []);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-zinc-950">
      <header className="shrink-0 px-6 py-4 border-b border-white/5 bg-zinc-900/80 backdrop-blur-sm relative z-50">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight shrink-0">AM Board</h1>
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  handleSearchSelect(searchResults[0]);
                } else if (e.key === 'Escape') {
                  setSearchQuery('');
                  setSearchOpen(false);
                  searchRef.current?.blur();
                }
              }}
              placeholder="Search cards…"
              className="w-full text-sm bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            />
            {searchOpen && searchResults.length > 0 && (
              <ul className="absolute top-full mt-1 left-0 right-0 z-[100] bg-zinc-800 border border-white/10 rounded-lg overflow-hidden shadow-xl">
                {searchResults.map(card => (
                  <li key={card.id}>
                    <button
                      type="button"
                      onMouseDown={() => handleSearchSelect(card)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                    >
                      <span className="text-sm text-zinc-100 truncate flex-1">{card.title}</span>
                      <span className="text-xs text-zinc-500 shrink-0">{card.state}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
            <button
              onClick={() => setShowTeam(v => !v)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors border ${showTeam ? 'bg-zinc-700 text-zinc-100 border-white/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
              title="Team"
            >
              Team
            </button>
            <button
              onClick={() => setShowMilestonePlanner(v => !v)}
              className={`text-sm px-2 py-1.5 rounded-lg transition-colors border ${showMilestonePlanner ? 'bg-sky-700/40 hover:bg-sky-700/60 text-sky-300 border-sky-500/50' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
              title="Open roadmap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </button>
            <button
              onClick={() => { setShowChat(v => !v); setChatUnread(false); }}
              className={`relative text-sm px-2 py-1.5 rounded-lg transition-colors border ${chatUnread && !showChat ? 'bg-violet-700/40 hover:bg-violet-700/60 text-violet-300 border-violet-500/50' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'}`}
              title="Open chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              {chatUnread && !showChat && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-violet-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setShowNewForm(v => !v)}
              className="text-sm px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-white font-medium transition-colors"
            >
              + New
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
            />
          </div>
        </div>
        {showNewForm && (
          <NewCardForm projectId={selectedProjectId} onClose={() => setShowNewForm(false)} />
        )}
      </header>

      <div className="flex-1 flex flex-row overflow-hidden">
        {STATES.map(state => (
          <CardColumn
            key={state}
            state={state}
            cards={cards.filter(c => c.state === state)}
            onCardClick={handleCardClick}
            celebratingIds={celebratingIds}
          />
        ))}
      </div>
      <CardPanel card={selectedCard} onClose={handleClosePanel} onCardUpdate={(updated) => {
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
        setSelectedCard(updated);
      }} />
      <ChatPanel
        open={showChat}
        onClose={() => setShowChat(false)}
        onCardOpen={(cardId) => {
          const card = cards.find(c => c.id === cardId);
          if (card) { setSelectedCard(card); setShowChat(false); }
        }}
      />
      <TeamPanel open={showTeam} onClose={() => setShowTeam(false)} />
      <MilestonePlannerPanel
        open={showMilestonePlanner}
        projectId={selectedProjectId}
        projectName={projects.find(p => p.id === selectedProjectId)?.name ?? ''}
        onClose={() => setShowMilestonePlanner(false)}
      />
    </div>
  );
}
