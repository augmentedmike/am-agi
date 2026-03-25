'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from './BoardClient';
import { CardTile } from './CardTile';

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  shipped: 'Shipped',
};

export type MobileColumnOption = { state: string; label: string; count: number };

type SharedColumnProps = {
  isMobileActive?: boolean;
  onMobileHeaderClick?: () => void;
  mobileColumnOptions?: MobileColumnOption[];
  onMobileColumnSelect?: (state: string) => void;
};

function MobileColumnPicker({
  options,
  onSelect,
  onClose,
}: {
  options: MobileColumnOption[];
  onSelect: (state: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 w-52 bg-zinc-800 border border-white/10 rounded-lg shadow-xl z-20 py-1 sm:hidden"
    >
      {options.map(opt => (
        <button
          key={opt.state}
          onClick={() => { onSelect(opt.state); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700/60 transition-colors flex items-center justify-between"
        >
          <span>{opt.label}</span>
          <span className="text-xs text-zinc-500 font-semibold">{opt.count}</span>
        </button>
      ))}
    </div>
  );
}

function ShippedColumn({
  cards,
  onCardClick,
  isMobileActive,
  onMobileHeaderClick,
  mobileColumnOptions,
  onMobileColumnSelect,
}: { cards: Card[]; onCardClick: (card: Card) => void } & SharedColumnProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('board:shipped-collapsed');
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('board:shipped-collapsed', String(next));
  }

  // On mobile, when not active, hide entirely
  const mobileVisibility = isMobileActive === false ? 'hidden sm:flex' : 'flex';

  if (collapsed) {
    return (
      <div
        className={`${mobileVisibility} flex-col items-center justify-start h-full border-r border-white/5 cursor-pointer hover:bg-zinc-800/30 transition-colors w-12 shrink-0 pt-4 gap-3`}
        onClick={toggle}
        title="Expand shipped column"
      >
        <span className="text-pink-500 text-lg leading-none">›</span>
        <span
          className="text-xs font-semibold uppercase tracking-widest text-zinc-400 select-none [writing-mode:vertical-rl] rotate-180"
        >
          Shipped ({cards.length})
        </span>
      </div>
    );
  }

  return (
    <div className={`${mobileVisibility} flex-1 h-full flex-col border-r border-white/5 min-w-0`}>
      <div className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between relative">
        {/* Mobile column picker trigger */}
        {onMobileHeaderClick && mobileColumnOptions ? (
          <button
            className="sm:hidden font-semibold text-sm uppercase tracking-wide text-zinc-400 flex items-center gap-1"
            onClick={() => setPickerOpen(v => !v)}
          >
            Shipped ({cards.length})
            <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : null}
        <h2 className="hidden sm:block font-semibold text-sm uppercase tracking-wide text-zinc-400">
          Shipped ({cards.length})
        </h2>
        {pickerOpen && mobileColumnOptions && onMobileColumnSelect && (
          <MobileColumnPicker
            options={mobileColumnOptions}
            onSelect={onMobileColumnSelect}
            onClose={() => setPickerOpen(false)}
          />
        )}
        <button
          onClick={toggle}
          className="text-zinc-500 hover:text-pink-500 transition-colors text-lg leading-none"
          title="Collapse shipped column"
        >
          ‹
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {[...cards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(card => (
          <CardTile key={card.id} card={card} onCardClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}

export function CardColumn({
  state,
  cards,
  onCardClick,
  isMobileActive,
  onMobileHeaderClick,
  mobileColumnOptions,
  onMobileColumnSelect,
}: {
  state: string;
  cards: Card[];
  onCardClick: (card: Card) => void;
} & SharedColumnProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (state === 'shipped') {
    return (
      <ShippedColumn
        cards={cards}
        onCardClick={onCardClick}
        isMobileActive={isMobileActive}
        onMobileHeaderClick={onMobileHeaderClick}
        mobileColumnOptions={mobileColumnOptions}
        onMobileColumnSelect={onMobileColumnSelect}
      />
    );
  }

  // On mobile, hide non-active columns
  const mobileVisibility = isMobileActive === false ? 'hidden sm:flex' : 'flex';

  return (
    <div className={`${mobileVisibility} flex-1 h-full flex-col border-r border-white/5 min-w-0`}>
      <div className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 relative">
        {/* Mobile: tappable header that opens column picker */}
        {onMobileHeaderClick && mobileColumnOptions ? (
          <button
            className="sm:hidden w-full text-left font-semibold text-sm uppercase tracking-wide text-zinc-400 flex items-center gap-1"
            onClick={() => setPickerOpen(v => !v)}
          >
            {COLUMN_LABELS[state] ?? state} ({cards.length})
            <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : null}
        <h2 className="hidden sm:block font-semibold text-sm uppercase tracking-wide text-zinc-400">
          {COLUMN_LABELS[state] ?? state} ({cards.length})
        </h2>
        {pickerOpen && mobileColumnOptions && onMobileColumnSelect && (
          <MobileColumnPicker
            options={mobileColumnOptions}
            onSelect={onMobileColumnSelect}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {cards.map(card => (
          <CardTile key={card.id} card={card} onCardClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
