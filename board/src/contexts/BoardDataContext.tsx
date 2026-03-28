'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useProjects } from './ProjectsContext';
import type { Card } from './CardPanelContext';

type BoardDataContextValue = {
  cards: Card[];
  celebratingIds: Set<string>;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
};

const BoardDataContext = createContext<BoardDataContextValue>({
  cards: [],
  celebratingIds: new Set(),
  setCards: () => {},
});

export function useBoardData() {
  return useContext(BoardDataContext);
}

export function BoardDataProvider({ initialCards, children }: { initialCards: Card[]; children: ReactNode }) {
  const { selectedProjectId } = useProjects();
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(new Set());
  const selectedProjectIdRef = useRef(selectedProjectId);

  useEffect(() => { selectedProjectIdRef.current = selectedProjectId; }, [selectedProjectId]);

  // WebSocket for real-time card events
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4221';
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function handleMessage(event: MessageEvent) {
      try {
        const ev = JSON.parse(event.data);
        const isAllMode = selectedProjectIdRef.current === '__all__';
        const cardMatchesProject = isAllMode || ev.card?.projectId === selectedProjectIdRef.current;
        if (ev.type === 'card_created' && cardMatchesProject) {
          setCards(prev => {
            if (prev.some((c: Card) => c.id === ev.card.id)) return prev;
            return [...prev, ev.card];
          });
        } else if ((ev.type === 'card_moved' || ev.type === 'card_updated') && cardMatchesProject) {
          setCards(prev => prev.map((c: Card) => c.id === ev.card.id ? ev.card : c));
          if (ev.type === 'card_moved' && ev.card.state === 'shipped') {
            const id = ev.card.id as string;
            setCelebratingIds(prev => new Set([...prev, id]));
            setTimeout(() => {
              setCelebratingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }, 4500);
          }
        }
      } catch {}
    }

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = handleMessage;
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => { ws.close(); };
    }

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Immediately refetch cards when the selected project changes
  useEffect(() => {
    let cancelled = false;
    const url = selectedProjectId === '__all__'
      ? '/api/cards'
      : `/api/cards?projectId=${encodeURIComponent(selectedProjectId ?? '')}`;
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then((data: Card[] | null) => { if (!cancelled && data) setCards(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  // Polling fallback: refetch cards every 5 seconds.
  // Merge: keep whichever version is more recently updated to avoid overwriting
  // local optimistic updates with a stale in-flight response.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const url = selectedProjectId === '__all__'
          ? '/api/cards'
          : `/api/cards?projectId=${encodeURIComponent(selectedProjectId ?? '')}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const fresh: Card[] = await res.json();
        setCards(prev => {
          const prevMap = new Map(prev.map(c => [c.id, c]));
          const merged = fresh.map(freshCard => {
            const local = prevMap.get(freshCard.id);
            // Keep local version if it's strictly newer (local edit not yet reflected in poll)
            if (local && local.updatedAt > freshCard.updatedAt) return local;
            return freshCard;
          });
          // Preserve any locally-known cards not yet in the polled list
          const freshIds = new Set(fresh.map(c => c.id));
          const localOnly = prev.filter(c => !freshIds.has(c.id));
          return [...merged, ...localOnly];
        });
      } catch {}
    }, 5_000);
    return () => clearInterval(id);
  }, [selectedProjectId]);

  return (
    <BoardDataContext.Provider value={{ cards, celebratingIds, setCards }}>
      {children}
    </BoardDataContext.Provider>
  );
}
