'use client';

import { useState } from 'react';
import { Card } from './BoardClient';

type SteerAction = 'approve' | 'escalate' | 'guidance' | 'feedback';

interface SteeringPanelProps {
  card: Card;
  onCardUpdate: (card: Card) => void;
}

interface ActionConfig {
  action: SteerAction;
  label: string;
  description: string;
  requiresMessage: boolean;
  messagePlaceholder?: string;
  colorClass: string;
  activeColorClass: string;
  icon: React.ReactNode;
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}

const ACTION_CONFIGS: ActionConfig[] = [
  {
    action: 'approve',
    label: 'Approve',
    description: 'Sign off on the current work',
    requiresMessage: false,
    colorClass: 'text-emerald-400 border-emerald-900/50 hover:bg-emerald-500/10 hover:border-emerald-700/50',
    activeColorClass: 'bg-emerald-500/10 border-emerald-700/50',
    icon: <CheckIcon />,
  },
  {
    action: 'escalate',
    label: 'Escalate',
    description: 'Flag a blocker and stop the agent',
    requiresMessage: true,
    messagePlaceholder: 'Describe the blocker or issue…',
    colorClass: 'text-red-400 border-red-900/50 hover:bg-red-500/10 hover:border-red-700/50',
    activeColorClass: 'bg-red-500/10 border-red-700/50',
    icon: <AlertIcon />,
  },
  {
    action: 'guidance',
    label: 'Guidance',
    description: 'Redirect the agent with new instructions',
    requiresMessage: true,
    messagePlaceholder: 'What should the agent do differently?',
    colorClass: 'text-blue-400 border-blue-900/50 hover:bg-blue-500/10 hover:border-blue-700/50',
    activeColorClass: 'bg-blue-500/10 border-blue-700/50',
    icon: <CompassIcon />,
  },
  {
    action: 'feedback',
    label: 'Feedback',
    description: 'Leave a comment on the work quality',
    requiresMessage: true,
    messagePlaceholder: 'Your feedback…',
    colorClass: 'text-amber-400 border-amber-900/50 hover:bg-amber-500/10 hover:border-amber-700/50',
    activeColorClass: 'bg-amber-500/10 border-amber-700/50',
    icon: <ChatIcon />,
  },
];

interface ModalState {
  action: SteerAction;
  message: string;
}

export function SteeringPanel({ card, onCardUpdate }: SteeringPanelProps) {
  const [loading, setLoading] = useState<SteerAction | null>(null);
  const [error, setError] = useState<{ action: SteerAction; message: string } | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  // Only visible for in-progress and in-review cards
  if (card.state !== 'in-progress' && card.state !== 'in-review') return null;

  async function submitAction(action: SteerAction, message?: string) {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${card.id}/steer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError({ action, message: body.error ?? `Request failed (${res.status})` });
        return;
      }
      const updated: Card = await res.json();
      onCardUpdate(updated);
      setModal(null);
    } catch {
      setError({ action, message: 'Network error — please try again.' });
    } finally {
      setLoading(null);
    }
  }

  function handleButtonClick(config: ActionConfig) {
    setError(null);
    if (config.requiresMessage) {
      setModal({ action: config.action, message: '' });
    } else {
      submitAction(config.action);
    }
  }

  function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const config = ACTION_CONFIGS.find(c => c.action === modal.action);
    if (config?.requiresMessage && !modal.message.trim()) return;
    submitAction(modal.action, modal.message);
  }

  const activeModal = modal ? ACTION_CONFIGS.find(c => c.action === modal.action) : null;

  return (
    <div className="mb-6">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-3">
        Agent Steering
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ACTION_CONFIGS.map((config) => {
          const isLoading = loading === config.action;
          const isDisabled = loading !== null;
          const hasError = error?.action === config.action;

          return (
            <div key={config.action} className="flex flex-col gap-1">
              <button
                onClick={() => handleButtonClick(config)}
                disabled={isDisabled}
                title={config.description}
                aria-label={config.label}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded border text-sm font-medium transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  config.colorClass,
                ].join(' ')}
              >
                {isLoading ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : config.icon}
                <span>{config.label}</span>
              </button>
              {hasError && (
                <p className="text-[11px] text-red-400 px-1">{error.message}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline modal */}
      {modal && activeModal && (
        <div className="mt-3 rounded-lg border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-400 mb-3">{activeModal.description}</p>
          <form onSubmit={handleModalSubmit} className="flex flex-col gap-3">
            <textarea
              value={modal.message}
              onChange={e => setModal(m => m ? { ...m, message: e.target.value } : m)}
              placeholder={activeModal.messagePlaceholder}
              rows={3}
              className="w-full rounded border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-white/20"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setModal(null); setError(null); }}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading !== null || (activeModal.requiresMessage && !modal.message.trim())}
                className={[
                  'px-3 py-1.5 rounded border text-xs font-medium transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  activeModal.colorClass,
                ].join(' ')}
              >
                {loading === modal.action ? 'Sending…' : `Send ${activeModal.label}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
