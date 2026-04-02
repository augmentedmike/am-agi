'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useBoardData } from './BoardDataContext';
import type { Card } from './CardPanelContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SteeringMode = 'reschedule' | 'conflict' | 'approval' | null;

export interface SteeringChange {
  card: Card;
  currentDate: Date;
  proposedDate: Date;
}

type CalendarSteeringContextValue = {
  pendingChange: SteeringChange | null;
  conflicts: Card[];
  mode: SteeringMode;
  proposeReschedule: (card: Card, newDate: Date) => void;
  /** Advance from reschedule mode → conflict or approval (re-runs conflict detection). */
  confirmReschedule: () => void;
  approveChange: () => Promise<void>;
  rejectChange: () => void;
  resolveConflict: (action: 'keep' | 'push' | 'choose') => Promise<void>;
  updateProposedDate: (newDate: Date) => void;
};

const CalendarSteeringContext = createContext<CalendarSteeringContextValue>({
  pendingChange: null,
  conflicts: [],
  mode: null,
  proposeReschedule: () => {},
  confirmReschedule: () => {},
  approveChange: async () => {},
  rejectChange: () => {},
  resolveConflict: async () => {},
  updateProposedDate: () => {},
});

export function useCalendarSteering() {
  return useContext(CalendarSteeringContext);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFLICT_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

function findConflicts(cards: Card[], proposedDate: Date, excludeCardId: string): Card[] {
  return cards.filter(c => {
    if (c.id === excludeCardId) return false;
    if (!c.scheduledAt) return false;
    const diff = Math.abs(new Date(c.scheduledAt).getTime() - proposedDate.getTime());
    return diff < CONFLICT_THRESHOLD_MS;
  });
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function CalendarSteeringProvider({ children }: { children: ReactNode }) {
  const { cards, setCards } = useBoardData();

  const [pendingChange, setPendingChange] = useState<SteeringChange | null>(null);
  const [conflicts, setConflicts] = useState<Card[]>([]);
  const [mode, setMode] = useState<SteeringMode>(null);

  const proposeReschedule = useCallback((card: Card, newDate: Date) => {
    const currentDate = card.scheduledAt ? new Date(card.scheduledAt) : new Date();
    const detectedConflicts = findConflicts(cards, newDate, card.id);

    setPendingChange({ card, currentDate, proposedDate: newDate });
    setConflicts(detectedConflicts);
    // Always open in reschedule mode so the user can review/adjust the proposed time.
    // Conflict mode is entered only after the user clicks Confirm (via confirmReschedule).
    setMode('reschedule');
  }, [cards]);

  const updateProposedDate = useCallback((newDate: Date) => {
    setPendingChange(prev => prev ? { ...prev, proposedDate: newDate } : null);
  }, []);

  const confirmReschedule = useCallback(() => {
    if (!pendingChange) return;
    const detected = findConflicts(cards, pendingChange.proposedDate, pendingChange.card.id);
    setConflicts(detected);
    setMode(detected.length > 0 ? 'conflict' : 'approval');
  }, [cards, pendingChange]);

  const rejectChange = useCallback(() => {
    setPendingChange(null);
    setConflicts([]);
    setMode(null);
  }, []);

  const approveChange = useCallback(async () => {
    if (!pendingChange) return;
    const { card, proposedDate } = pendingChange;
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: proposedDate.toISOString() }),
      });
      if (res.ok) {
        const updated: Card = await res.json();
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
    } catch { /* network error — silently ignore */ }
    setPendingChange(null);
    setConflicts([]);
    setMode(null);
  }, [pendingChange, setCards]);

  const resolveConflict = useCallback(async (action: 'keep' | 'push' | 'choose') => {
    if (action === 'choose') {
      // Return to reschedule mode so user can pick a different slot
      setConflicts([]);
      setMode('reschedule');
      return;
    }

    if (action === 'push') {
      // PATCH each conflicting card's scheduledAt +1 hour
      await Promise.all(conflicts.map(async (c) => {
        if (!c.scheduledAt) return;
        const advanced = new Date(new Date(c.scheduledAt).getTime() + 60 * 60 * 1000);
        try {
          const res = await fetch(`/api/cards/${c.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduledAt: advanced.toISOString() }),
          });
          if (res.ok) {
            const updated: Card = await res.json();
            setCards(prev => prev.map(existing => existing.id === updated.id ? updated : existing));
          }
        } catch { /* ignore */ }
      }));
    }

    // Both 'keep' and 'push' advance to approval mode
    setConflicts([]);
    setMode('approval');
  }, [conflicts, setCards]);

  return (
    <CalendarSteeringContext.Provider value={{
      pendingChange,
      conflicts,
      mode,
      proposeReschedule,
      confirmReschedule,
      approveChange,
      rejectChange,
      resolveConflict,
      updateProposedDate,
    }}>
      {children}
    </CalendarSteeringContext.Provider>
  );
}
