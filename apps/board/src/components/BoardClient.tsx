'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CardColumn } from './CardColumn';
import { CardPanel } from './CardPanel';
import { NewCardForm } from './NewCardForm';
import { ProjectSelector } from './ProjectSelector';
import { ProjectSettings } from './ProjectSettings';

type WorkLogEntry = { timestamp: string; message: string };
type Attachment = { path: string; name: string };

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
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(new Set());
  // selectedProjectId is stable per page — project switching triggers router navigation
  const selectedProjectId = initialProjectId;
  const [projects, setProjects] = useState<Project[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {});
  }, []);

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

  useEffect(() => {
    const es = new EventSource('/api/ws');
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        const cardMatchesProject = (event.card?.projectId ?? null) === selectedProjectIdRef.current;
        if (event.type === 'card_created' && cardMatchesProject) {
          setCards(prev => {
            if (prev.some(c => c.id === event.card.id)) return prev;
            return [...prev, event.card];
          });
        } else if ((event.type === 'card_moved' || event.type === 'card_updated') && cardMatchesProject) {
          setCards(prev => prev.map(c => c.id === event.card.id ? event.card : c));
          // Update selected card if it moved or updated
          setSelectedCard(prev => prev?.id === event.card.id ? event.card : prev);
          // Trigger flip celebration when a card lands in shipped
          if (event.type === 'card_moved' && event.card.state === 'shipped') {
            const id = event.card.id as string;
            setCelebratingIds(prev => new Set([...prev, id]));
            setTimeout(() => {
              setCelebratingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }, 4500); // 3s meme + 0.7s flip-back + buffer
          }
        }
      } catch {}
    };
    return () => es.close();
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
    if (id === selectedProjectId) return;
    router.push(id ? `/p/${id}` : '/');
  }, [selectedProjectId, router]);

  const handleClosePanel = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const activeCount = cards.filter(c => !!c.workDir && c.state !== 'shipped').length;

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
              onProjectCreated={(p) => setProjects(prev => [...prev, p])}
            />
            <ProjectSettings
              project={projects.find(p => p.id === selectedProjectId) ?? null}
              onProjectUpdated={(p) => setProjects(prev => prev.map(x => x.id === p.id ? p : x))}
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
    </div>
  );
}
