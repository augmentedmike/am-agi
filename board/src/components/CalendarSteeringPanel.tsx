'use client';

import { useEffect, useRef } from 'react';
import { useCalendarSteering } from '@/contexts/CalendarSteeringContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDatetime(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function toDatetimeLocal(d: Date): string {
  // Format: YYYY-MM-DDTHH:mm (local time)
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): Date {
  return new Date(value);
}

// ── CalendarSteeringPanel ─────────────────────────────────────────────────────

export function CalendarSteeringPanel() {
  const {
    pendingChange,
    conflicts,
    mode,
    confirmReschedule,
    approveChange,
    rejectChange,
    resolveConflict,
    updateProposedDate,
  } = useCalendarSteering();

  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key closes panel
  useEffect(() => {
    if (!mode) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') rejectChange();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, rejectChange]);

  if (!mode || !pendingChange) return null;

  const { card, currentDate, proposedDate } = pendingChange;

  // ── Reschedule mode ───────────────────────────────────────────────────────

  function RescheduleMode() {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Event</div>
          <div className="text-white font-semibold text-base leading-snug">{card.title}</div>
        </div>

        <div>
          <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Current time</div>
          <div className="text-white/80 text-sm">{fmtDatetime(currentDate)}</div>
        </div>

        <div>
          <div className="text-white/50 text-xs uppercase tracking-wider mb-2">New date &amp; time</div>
          <input
            type="datetime-local"
            defaultValue={toDatetimeLocal(proposedDate)}
            onChange={e => {
              if (e.target.value) updateProposedDate(fromDatetimeLocal(e.target.value));
            }}
            className="w-full rounded-lg px-3 py-2 text-sm text-white bg-white/10 border border-white/20 focus:outline-none focus:border-[#0a84ff]"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={rejectChange}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-white/70 bg-white/10 hover:bg-white/15 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmReschedule}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-[#0a84ff] hover:bg-[#0a84ff]/90 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }

  // ── Conflict resolution mode ──────────────────────────────────────────────

  function ConflictMode() {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-amber-400 text-sm font-semibold mb-1">Scheduling conflict</div>
          <div className="text-white/60 text-xs">
            The proposed time overlaps with {conflicts.length} event{conflicts.length !== 1 ? 's' : ''}:
          </div>
        </div>

        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {conflicts.map(c => (
            <div
              key={c.id}
              className="rounded-lg px-3 py-2 bg-white/[0.06] border border-white/10"
            >
              <div className="text-white text-sm font-medium leading-snug">{c.title}</div>
              {c.scheduledAt && (
                <div className="text-white/40 text-xs mt-0.5">
                  {fmtDatetime(new Date(c.scheduledAt))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => resolveConflict('keep')}
            className="w-full py-2 rounded-xl text-sm font-medium text-white bg-white/10 hover:bg-white/15 transition-colors text-left px-4"
          >
            Keep original slot
          </button>
          <button
            onClick={() => resolveConflict('push')}
            className="w-full py-2 rounded-xl text-sm font-medium text-white bg-amber-500/20 hover:bg-amber-500/30 transition-colors text-left px-4"
          >
            Push conflicting events later (+1 hr)
          </button>
          <button
            onClick={() => resolveConflict('choose')}
            className="w-full py-2 rounded-xl text-sm font-medium text-[#0a84ff] bg-[#0a84ff]/10 hover:bg-[#0a84ff]/20 transition-colors text-left px-4"
          >
            Choose different slot
          </button>
        </div>
      </div>
    );
  }

  // ── Approval mode ─────────────────────────────────────────────────────────

  function ApprovalMode() {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Confirm reschedule</div>
          <div className="rounded-xl bg-white/[0.06] border border-white/10 px-4 py-3">
            <p className="text-white text-sm leading-relaxed">
              Move{' '}
              <span className="font-semibold text-white">&apos;{card.title}&apos;</span>
              {' '}from{' '}
              <span className="text-white/70">{fmtDatetime(currentDate)}</span>
              {' '}to{' '}
              <span className="text-[#0a84ff] font-medium">{fmtDatetime(proposedDate)}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={rejectChange}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-white/70 bg-white/10 hover:bg-white/15 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={approveChange}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-500/90 transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    );
  }

  // ── Mode title ────────────────────────────────────────────────────────────

  const titles: Record<string, string> = {
    reschedule: 'Reschedule Event',
    conflict: 'Resolve Conflict',
    approval: 'Approve Change',
  };

  return (
    <>
      {/* Backdrop — dims background without blocking the calendar */}
      <div
        className="fixed inset-0 z-[160] pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.3)' }}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 bottom-0 z-[170] flex flex-col w-full max-w-sm shadow-2xl"
        style={{
          background: '#2c2c2e',
          borderLeft: '1px solid rgba(255,255,255,0.12)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="text-white font-semibold text-base">{titles[mode ?? 'reschedule']}</span>
          <button
            onClick={rejectChange}
            className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg className="h-4 w-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {mode === 'reschedule' && <RescheduleMode />}
          {mode === 'conflict' && <ConflictMode />}
          {mode === 'approval' && <ApprovalMode />}
        </div>
      </div>
    </>
  );
}
