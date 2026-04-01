'use client';

import { useMobileModalStack } from '@/contexts/MobileModalStackContext';

/**
 * Back button visible only on mobile (hidden sm:inline-flex).
 * Pops the topmost panel from the MobileModalStack and optionally
 * calls onBack (e.g. the panel's own onClose) to actually close it.
 */
export function MobileBackButton({ className = '', onBack }: { className?: string; onBack?: () => void }) {
  const { pop } = useMobileModalStack();

  function handleClick() {
    pop();
    onBack?.();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`sm:hidden inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 transition-colors px-1 py-0.5 -ml-1 rounded ${className}`}
      aria-label="Go back"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}
