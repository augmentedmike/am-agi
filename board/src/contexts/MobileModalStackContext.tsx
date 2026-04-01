'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type ModalId =
  | 'card'
  | 'chat'
  | 'search'
  | 'settings'
  | 'milestone'
  | 'file-viewer'
  | 'file-viewer-card'
  | 'card-chat';

interface MobileModalStackContext {
  /** Ordered stack — last element is topmost (visible) */
  stack: ModalId[];
  /** Push a panel onto the stack (mobile only — no-op on desktop) */
  push: (id: ModalId) => void;
  /** Pop the topmost panel */
  pop: () => void;
  /** Remove a specific id from wherever it is in the stack */
  remove: (id: ModalId) => void;
  /** True if id is the topmost panel */
  isTop: (id: ModalId) => boolean;
  /** True if id is anywhere in the stack */
  isOpen: (id: ModalId) => boolean;
  /** Clear the whole stack */
  clear: () => void;
}

const Ctx = createContext<MobileModalStackContext>({
  stack: [],
  push: () => {},
  pop: () => {},
  remove: () => {},
  isTop: () => false,
  isOpen: () => false,
  clear: () => {},
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function MobileModalStackProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<ModalId[]>([]);
  // Track whether we pushed a history entry for each stack item
  const historyDepth = useRef(0);

  const isMobile = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  }, []);

  const push = useCallback((id: ModalId) => {
    if (!isMobile()) return;
    setStack(prev => {
      // Don't duplicate — move existing to top
      const filtered = prev.filter(x => x !== id);
      return [...filtered, id];
    });
    // Push a history entry so popstate fires on OS back
    if (typeof window !== 'undefined') {
      window.history.pushState({ mobileModal: id }, '');
      historyDepth.current += 1;
    }
  }, [isMobile]);

  const pop = useCallback(() => {
    setStack(prev => prev.slice(0, -1));
  }, []);

  const remove = useCallback((id: ModalId) => {
    setStack(prev => prev.filter(x => x !== id));
  }, []);

  const clear = useCallback(() => {
    setStack([]);
    historyDepth.current = 0;
  }, []);

  const isTop = useCallback((id: ModalId) => {
    return stack.length > 0 && stack[stack.length - 1] === id;
  }, [stack]);

  const isOpen = useCallback((id: ModalId) => {
    return stack.includes(id);
  }, [stack]);

  // Handle browser/OS back gesture — pop the topmost panel
  useEffect(() => {
    function handlePopState() {
      if (!isMobile()) return;
      setStack(prev => {
        if (prev.length === 0) return prev;
        historyDepth.current = Math.max(0, historyDepth.current - 1);
        return prev.slice(0, -1);
      });
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobile]);

  return (
    <Ctx.Provider value={{ stack, push, pop, remove, isTop, isOpen, clear }}>
      {children}
    </Ctx.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMobileModalStack() {
  return useContext(Ctx);
}
