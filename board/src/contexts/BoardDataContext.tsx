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
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4201';
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function handleMessage(event: MessageEvent) {
      try {
        const ev = JSON.parse(event.data);
        const cardMatchesProject = (ev.card?.projectId ?? null) === selectedProjectIdRef.current;
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
    const projectId = selectedProjectId ?? '';
    let cancelled = false;
    fetch(`/api/cards?projectId=${encodeURIComponent(projectId)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Card[] | null) => { if (!cancelled && data) setCards(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  // Polling fallback: refetch cards every 5 seconds
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const projectId = selectedProjectId ?? '';
        const res = await fetch(`/api/cards?projectId=${encodeURIComponent(projectId)}`);
        if (!res.ok) return;
        const fresh: Card[] = await res.json();
        setCards(fresh);
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
