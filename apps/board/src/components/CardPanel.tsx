'use client';

import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card } from './BoardClient';

function buildMarkdown(card: Card): string {
  const lines: string[] = [];
  lines.push(`# ${card.title}`, '');
  lines.push(`**State:** ${card.state}  `);
  lines.push(`**Priority:** ${card.priority}  `);
  lines.push(`**ID:** \`${card.id}\`  `);
  lines.push(`**Created:** ${new Date(card.createdAt).toLocaleString()}  `);
  lines.push(`**Updated:** ${new Date(card.updatedAt).toLocaleString()}`);
  lines.push('');

  if (card.attachments.length > 0) {
    lines.push('## Attachments', '');
    for (const att of card.attachments) {
      lines.push(`- ${att.name} — \`${att.path}\``);
    }
    lines.push('');
  }

  if (card.workLog.length > 0) {
    lines.push('## Work Log', '');
    for (const entry of card.workLog) {
      lines.push(`**${new Date(entry.timestamp).toLocaleString()}** — ${entry.message}`, '');
    }
  }

  return lines.join('\n');
}

export function CardPanel({ card, onClose }: { card: Card | null; onClose: () => void }) {
  useEffect(() => {
    if (!card) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [card, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${card ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`absolute inset-y-0 right-0 w-full sm:max-w-xl bg-zinc-900/95 backdrop-blur-md border-l border-white/10 flex flex-col transition-transform duration-300 ${card ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <span className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Card Detail</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {card && (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{buildMarkdown(card)}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
