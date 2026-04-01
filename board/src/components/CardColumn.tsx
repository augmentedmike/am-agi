'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from './BoardClient';
import { CardTile } from './CardTile';
import { useLocale } from '@/contexts/LocaleContext';
import type { TranslationKeys } from '@/i18n/en';
import { STATE_TOKENS } from '@/lib/tokens';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ColumnPromptEditor } from './ColumnPromptEditor';

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

const COLUMN_LABEL_KEYS: Record<string, string> = {
  backlog: 'backlog',
  'in-progress': 'inProgress',
  'in-review': 'inReview',
  shipped: 'shipped',
};

// Custom column labels per template type
// Keys match templateType values set on project creation
const TEMPLATE_COLUMN_LABELS: Record<string, Record<string, string>> = {
  'sales-outbound': {
    backlog:      'Leads',
    'in-progress': 'Contacted',
    'in-review':   'Proposal',
    shipped:       'Closed',
  },
  'customer-support': {
    backlog:      'Inbox',
    'in-progress': 'In Progress',
    'in-review':   'Pending',
    shipped:       'Resolved',
  },
  'content-marketing': {
    backlog:      'Scripts',
    'in-progress': 'Production',
    'in-review':   'Ready',
    shipped:       'Scheduled',
  },
  'customer-success': {
    backlog:      'Onboarding',
    'in-progress': 'Active',
    'in-review':   'At Risk',
    shipped:       'Renewed',
  },
  'hiring': {
    backlog:      'Sourced',
    'in-progress': 'Interviewing',
    'in-review':   'Offer',
    shipped:       'Hired',
  },
  'partnerships': {
    backlog:      'Prospects',
    'in-progress': 'Negotiating',
    'in-review':   'Legal',
    shipped:       'Active',
  },
  'pr-outreach': {
    backlog:      'Targets',
    'in-progress': 'Outreach',
    'in-review':   'Following Up',
    shipped:       'Coverage',
  },
  'knowledge-base': {
    backlog:      'Draft',
    'in-progress': 'Writing',
    'in-review':   'Review',
    shipped:       'Published',
  },
  'community': {
    backlog:      'Ideas',
    'in-progress': 'Active',
    'in-review':   'Review',
    shipped:       'Done',
  },
  'ops': {
    backlog:      'Backlog',
    'in-progress': 'In Progress',
    'in-review':   'Verification',
    shipped:       'Done',
  },
};


export type MobileColumnOption = { state: string; label: string; count: number };

type SharedColumnProps = {
  isMobileActive?: boolean;
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
      className="absolute top-full left-0 mt-1 w-52 max-w-[90vw] bg-zinc-800 border border-white/10 rounded-lg shadow-xl z-20 py-1 sm:hidden"
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
  mobileColumnOptions,
  onMobileColumnSelect,
  celebratingIds,
  templateType,
  advancedMode,
  projectId,
}: { cards: Card[]; onCardClick: (card: Card) => void; templateType?: string | null; advancedMode?: boolean; projectId?: string } & SharedColumnProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const colors = STATE_TOKENS['shipped'];
  const { t } = useLocale();
  const { spotlightColumns } = useOnboarding();
  const shippedLabel = (templateType && TEMPLATE_COLUMN_LABELS[templateType]?.shipped) ?? t('shipped');

  useEffect(() => {
    const stored = localStorage.getItem('board:shipped-collapsed');
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('board:shipped-collapsed', String(next));
  }

  // Auto-expand when any card in this column is celebrating; revert after animation ends
  const isAnyCardCelebrating = cards.some(c => celebratingIds?.has(c.id));
  const effectiveCollapsed = collapsed && !isAnyCardCelebrating;

  // On mobile, when not active, hide entirely
  const mobileVisibility = isMobileActive === false ? 'hidden sm:flex' : 'flex';

  if (effectiveCollapsed) {
    return (
      <button
        type="button"
        className={`${mobileVisibility} flex-col items-center justify-start h-full border-r border-white/5 cursor-pointer hover:bg-zinc-800/30 transition-colors w-12 shrink-0 pt-4 gap-3`}
        onClick={toggle}
        title={t('expandShipped')}
        aria-label={t('expandShipped')}
        aria-expanded={false}
      >
        <span className={`${colors.text} text-lg leading-none`}>›</span>
        <span
          className={`text-xs font-semibold uppercase tracking-widest ${colors.text} select-none [writing-mode:vertical-rl] rotate-180`}
        >
          {shippedLabel} ({cards.length})
        </span>
      </button>
    );
  }

  return (
    <div className={`${mobileVisibility} flex-1 h-full flex-col border-r border-white/5 min-w-0`}>
      <div
        data-kanban-col="shipped"
        className={`sticky top-0 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between relative ${colors.border} ${spotlightColumns ? 'z-[60] ring-2 ring-blue-400 ring-inset rounded-sm' : 'z-10'}`}
      >
        {/* Mobile column picker trigger */}
        {mobileColumnOptions ? (
          <button
            className={`sm:hidden font-semibold text-sm uppercase tracking-wide ${colors.text} flex items-center gap-1`}
            onClick={() => setPickerOpen(v => !v)}
            aria-label={`${shippedLabel} — select column`}
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
          >
            {shippedLabel} ({cards.length})
            <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : null}
        <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0">
          <h2 className={`font-semibold text-sm uppercase tracking-wide ${colors.text}`}>
            {shippedLabel} ({cards.length})
          </h2>
          {advancedMode && projectId && (
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="text-xs px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors font-mono leading-none"
            >
              edit
            </button>
          )}
        </div>
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
          aria-label={t('collapseShipped')}
          aria-expanded={true}
        >
          ‹
        </button>
      </div>
      {editorOpen && projectId && (
        <ColumnPromptEditor
          projectId={projectId}
          state="shipped"
          stateLabel={shippedLabel}
          onClose={() => setEditorOpen(false)}
        />
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {[...cards].sort((a, b) => {
          const aDate = a.shippedAt ?? a.updatedAt;
          const bDate = b.shippedAt ?? b.updatedAt;
          return bDate.localeCompare(aDate);
        }).map(card => (
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
  mobileColumnOptions,
  onMobileColumnSelect,
  celebratingIds,
  templateType,
  advancedMode,
  projectId,
}: {
  state: string;
  cards: Card[];
  onCardClick: (card: Card) => void;
  templateType?: string | null;
  advancedMode?: boolean;
  projectId?: string;
} & SharedColumnProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const { t } = useLocale();
  const { spotlightColumns } = useOnboarding();

  // Resolve column label: template-specific override or i18n fallback
  const colLabel = (templateType && TEMPLATE_COLUMN_LABELS[templateType]?.[state])
    ?? t((COLUMN_LABEL_KEYS[state] ?? 'backlog') as TranslationKeys);

  if (state === 'shipped') {
    return (
      <ShippedColumn
        cards={cards}
        onCardClick={onCardClick}
        isMobileActive={isMobileActive}
        mobileColumnOptions={mobileColumnOptions}
        onMobileColumnSelect={onMobileColumnSelect}
        celebratingIds={celebratingIds}
        templateType={templateType}
        advancedMode={advancedMode}
        projectId={projectId}
      />
    );
  }

  const colors = STATE_TOKENS[state] ?? STATE_TOKENS['backlog'];
  const activeInColumn = cards.filter(c => !!c.workDir).length;

  // On mobile, hide non-active columns
  const mobileVisibility = isMobileActive === false ? 'hidden sm:flex' : 'flex';

  return (
    <div className={`${mobileVisibility} flex-1 h-full flex-col border-r border-white/5 min-w-0`}>
      <div
        data-kanban-col={state}
        className={`sticky top-0 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 relative ${colors.border} ${spotlightColumns ? 'z-[60] ring-2 ring-blue-400 ring-inset rounded-sm' : 'z-10'}`}
      >
        {/* Mobile: tappable header that opens column picker */}
        {mobileColumnOptions ? (
          <button
            className={`sm:hidden w-full text-left font-semibold text-sm uppercase tracking-wide ${colors.text} flex items-center gap-1`}
            onClick={() => setPickerOpen(v => !v)}
            aria-label={`${colLabel} — select column`}
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
          >
            {colLabel} ({cards.length})
            <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : null}
        <div className="hidden sm:flex items-center gap-2">
          <h2 className={`font-semibold text-sm uppercase tracking-wide ${colors.text}`}>
            {colLabel} ({cards.length})
          </h2>
          {activeInColumn > 0 && (
            <span className="relative flex h-2.5 w-2.5" title={`${activeInColumn} agent${activeInColumn === 1 ? '' : 's'} active`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.dotPing} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors.dot}`} />
            </span>
          )}
          {advancedMode && projectId && (
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="text-xs px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors font-mono leading-none"
            >
              edit
            </button>
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
      {editorOpen && projectId && (
        <ColumnPromptEditor
          projectId={projectId}
          state={state}
          stateLabel={colLabel}
          onClose={() => setEditorOpen(false)}
        />
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {cards.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-4">{t('noCardsInPhase')}</p>
        )}
        {[...cards].sort(sortCards).map(card => (
          <CardTile key={card.id} card={card} onCardClick={onCardClick} celebrating={celebratingIds?.has(card.id) ?? false} />
        ))}
      </div>
    </div>
  );
}
