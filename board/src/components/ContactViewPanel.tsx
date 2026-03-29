'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import type { TeamMember } from './TeamPanel';

type TeamRole = TeamMember['role'];

const ROLE_BADGE: Record<TeamRole, string> = {
  owner:   'bg-pink-500/20 text-pink-400 border-pink-500/30',
  manager: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  expert:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  tester:  'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
};

type MemoryEntry = {
  id: string | number;
  content: string;
  topic?: string;
};

export function ContactViewPanel({
  contact,
  onClose,
}: {
  contact: TeamMember;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(true);

  useEffect(() => {
    setLoadingMemories(true);
    fetch(`/api/memory?q=${encodeURIComponent(contact.name)}`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: MemoryEntry[]) => setMemories(Array.isArray(data) ? data : []))
      .catch(() => setMemories([]))
      .finally(() => setLoadingMemories(false));
  }, [contact.name]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm bg-zinc-900 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">{t('contactView')}</h2>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="text-xs px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Contact details */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 p-4 rounded-lg bg-zinc-800/60 border border-white/5">
            {contact.avatarUrl && (
              <img
                src={contact.avatarUrl}
                alt={contact.name}
                className="w-16 h-16 rounded-full object-cover mb-1"
              />
            )}
            <div className="text-base font-semibold text-zinc-100">{contact.name}</div>
            <div className="text-sm text-zinc-400">{contact.email}</div>
            {contact.jobTitle && (
              <div className="text-sm text-zinc-400">{contact.jobTitle}</div>
            )}
            <span
              className={`self-start inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE[contact.role]}`}
            >
              {contact.role}
            </span>
          </div>

          {/* Memories section */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t('contactMemories')}
            </h3>
            {loadingMemories && (
              <p className="text-sm text-zinc-500">{t('loading')}</p>
            )}
            {!loadingMemories && memories.length === 0 && (
              <p className="text-sm text-zinc-500 py-2">{t('noMemories')}</p>
            )}
            {!loadingMemories && memories.map(m => (
              <div
                key={m.id}
                className="p-3 rounded-lg bg-zinc-800/60 border border-white/5 text-sm text-zinc-300"
              >
                {m.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
