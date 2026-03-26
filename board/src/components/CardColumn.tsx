'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from './BoardClient';
import { CardTile } from './CardTile';
import { useLocale } from '@/contexts/LocaleContext';
import type { Translations } from '@/i18n';

const PRIORITY_RANK: Record<string, number> = {
  AI: 0,
  critical: 1,
  high: 2,
  normal: 3,
  low: 4,
};

function sortCards(a: Card, b: Card): number {
  const aActive = !!a.workDir;
  const bActive = !!b.workDir;
  if (aActive !== bActive) return aActive ? -1 : 1;
  return (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
}

const COLUMN_LABEL_KEYS: Record<string, keyof Translations> = {
  backlog: 'backlog',
  'in-progress': 'inProgress',
  'in-review': 'inReview',
  shipped: 'shipped',
};

const COLUMN_COLORS: Record<string, { border: string; text: string; dot: string; dotPing: string }> = {
  backlog: {
    border: 'border-l-2 border-l-zinc-600',
    text: 'text-zinc-400',
    dot: 'bg-zinc-500',
    dotPing: 'bg-zinc-400',
  },
  'in-progress': {
    border: 'border-l-2 border-l-amber-500',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    dotPing: 'bg-amber-400',
  },
  'in-review': {
    border: 'border-l-2 border-l-violet-500',
    text: 'text-violet-400',
    dot: 'bg-violet-500',
    dotPing: 'bg-violet-400',
  },
  shipped: {
    border: 'border-l-2 border-l-emerald-500',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
    dotPing: 'bg-emerald-400',
  },
};

export type MobileColumnOption = { state: string; label: string; count: number };

type SharedColumnProps = {
  isMobileActive?: boolean;
  onMobileHeaderClick?: () => void;
  mobileColumnOptions?: MobileColumnOption[];
  onMobileColumnSelect?: (state: string) => void;
  celebratingIds?: Set<string>;
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
  celebratingIds,
}: { cards: Card[]; onCardClick: (card: Card) => void } & SharedColumnProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const colors = COLUMN_COLORS['shipped'];
  const { t } = useLocale();

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
        title={t('expandShipped')}
      >
        <span className={`${colors.text} text-lg leading-none`}>›</span>
        <span
          className={`text-xs font-semibold uppercase tracking-widest ${colors.text} select-none [writing-mode:vertical-rl] rotate-180`}
        >
          {t('shipped')} ({cards.length})
        </span>
      </div>
    );
  }

  return (
    <div className={`${mobileVisibility} flex-1 h-full flex-col border-r border-white/5 min-w-0`}>
      <div className={`sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between relative ${colors.border}`}>
        {/* Mobile column picker trigger */}
        {onMobileHeaderClick && mobileColumnOptions ? (
          <button
            className={`sm:hidden font-semibold text-sm uppercase tracking-wide ${colors.text} flex items-center gap-1`}
            onClick={() => setPickerOpen(v => !v)}
          >
            {t('shipped')} ({cards.length})
            <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : null}
        <h2 className={`hidden sm:block font-semibold text-sm uppercase tracking-wide ${colors.text}`}>
          {t('shipped')} ({cards.length})
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
          className={`${colors.text} hover:opacity-80 transition-opacity text-lg leading-none`}
          title={t('collapseShipped')}
        >
          ‹
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {[...cards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(card => (
          <CardTile key={card.id} card={card} onCardClick={onCardClick} celebrating={celebratingIds?.has(card.id) ?? false} />
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
  celebratingIds,
}: {
  state: string;
  cards: Card[];
  onCardClick: (card: Card) => void;
} & SharedColumnProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { t } = useLocale();

  if (state === 'shipped') {
    return (
      <ShippedColumn
        cards={cards}
        onCardClick={onCardClick}
        isMobileActive={isMobileActive}
        onMobileHeaderClick={onMobileHeaderClick}
        mobileColumnOptions={mobileColumnOptions}
        onMobileColumnSelect={onMobileColumnSelect}
        celebratingIds={celebratingIds}
      />
    );
  }

  const colors = COLUMN_COLORS[state] ?? COLUMN_COLORS['backlog'];
  const activeInColumn = cards.filter(c => !!c.workDir).length;

  // On mobile, hide non-active columns
  const mobileVisibility = isMobileActive === false ? 'hidden sm:flex' : 'flex';

  return (
    <div className={`${mobileVisibility} flex-1 h-full flex-col border-r border-white/5 min-w-0`}>
      <div className={`sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 relative ${colors.border}`}>
        {/* Mobile: tappable header that opens column picker */}
        {onMobileHeaderClick && mobileColumnOptions ? (
          <button
            className={`sm:hidden w-full text-left font-semibold text-sm uppercase tracking-wide ${colors.text} flex items-center gap-1`}
            onClick={() => setPickerOpen(v => !v)}
          >
            {t(COLUMN_LABEL_KEYS[state] ?? 'backlog')} ({cards.length})
            <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : null}
        <div className="hidden sm:flex items-center gap-2">
          <h2 className={`font-semibold text-sm uppercase tracking-wide ${colors.text}`}>
            {t(COLUMN_LABEL_KEYS[state] ?? 'backlog')} ({cards.length})
          </h2>
          {activeInColumn > 0 && (
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.dotPing} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors.dot}`} />
            </span>
          )}
        </div>
        {pickerOpen && mobileColumnOptions && onMobileColumnSelect && (
          <MobileColumnPicker
            options={mobileColumnOptions}
            onSelect={onMobileColumnSelect}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {[...cards].sort(sortCards).map(card => (
          <CardTile key={card.id} card={card} onCardClick={onCardClick} celebrating={celebratingIds?.has(card.id) ?? false} />
        ))}
      </div>
    </div>
  );
}
