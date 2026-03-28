'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { CardComposer, CardComposerHandle } from './CardComposer';

type Priority = 'AI' | 'critical' | 'high' | 'normal' | 'low';

const TAGS: Priority[] = ['AI', 'critical', 'high', 'normal', 'low'];

const TAG_STYLE: Record<Priority, { active: string; inactive: string }> = {
  AI:       { active: 'bg-violet-500 text-white border border-violet-400',       inactive: 'bg-violet-500/20 text-violet-300 border border-violet-500/30' },
  critical: { active: 'bg-red-500 text-white border border-red-400',             inactive: 'bg-red-500/20 text-red-300 border border-red-500/30' },
  high:     { active: 'bg-orange-500 text-white border border-orange-400',       inactive: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' },
  normal:   { active: 'bg-zinc-500 text-white border border-zinc-400',           inactive: 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30' },
  low:      { active: 'bg-blue-500 text-white border border-blue-400',           inactive: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
};

const DRAFT_KEY = 'new-card-draft';

interface DraftData {
  text: string;
  priority: Priority;
  files: Array<{ name: string; type: string; dataUrl: string }>;
}

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftData;
  } catch {
    return null;
  }
}

function saveDraft(data: Partial<DraftData>, current: DraftData) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...current, ...data }));
  } catch {
    // QuotaExceededError or other — try without files
    try {
      const { files: _files, ...withoutFiles } = { ...current, ...data };
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...withoutFiles, files: [] }));
    } catch {
      // Give up silently
    }
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function NewCardForm({ onClose, projectId = null }: { onClose: () => void; projectId?: string | null }) {
  const { t } = useLocale();

  // Hydrate from localStorage on first render
  const draft = useRef<DraftData>(loadDraft() ?? { text: '', priority: 'AI', files: [] });

  const [priority, setPriority] = useState<Priority>(draft.current.priority);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const composerRef = useRef<CardComposerHandle>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClear(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist priority changes
  useEffect(() => {
    draft.current = { ...draft.current, priority };
    saveDraft({ priority }, draft.current);
  }, [priority]);

  function handleTextChange(text: string) {
    draft.current = { ...draft.current, text };
    saveDraft({ text }, draft.current);
  }

  function handleFilesChange(files: Array<{ name: string; type: string; dataUrl: string }>) {
    draft.current = { ...draft.current, files };
    saveDraft({ files }, draft.current);
  }

  function handleClear() {
    clearDraft();
    onClose();
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => !f.type.startsWith('video/'));
    if (files.length > 0) composerRef.current?.addFiles(files);
  }

  async function handleSubmit(title: string, files: File[]) {
    if (!title.trim()) { setError('Title is required.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), priority, projectId }),
      });
      if (!res.ok) { setError(await res.text() || 'Failed to create card.'); return; }
      const newCard = await res.json();
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        await fetch(`/api/cards/${newCard.id}/upload`, { method: 'POST', body: formData });
      }
      clearDraft();
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative mt-3 bg-zinc-800/80 border border-white/10 rounded-xl p-4"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-blue-950/80 border-2 border-dashed border-blue-400 rounded-xl pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span className="text-blue-200 text-sm font-semibold">Drop images and documents here</span>
          <span className="text-blue-400 text-xs">to be attached and referenced in the card</span>
        </div>
      )}

      <CardComposer
        ref={composerRef}
        placeholder="Describe what needs to be done…"
        submitLabel="Create"
        cancelLabel={t('clear')}
        submitting={submitting}
        error={error || undefined}
        onSubmit={handleSubmit}
        onCancel={handleClear}
        initialText={draft.current.text}
        initialFiles={draft.current.files}
        onTextChange={handleTextChange}
        onFilesChange={handleFilesChange}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setPriority(tag)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${
                priority === tag ? TAG_STYLE[tag].active : TAG_STYLE[tag].inactive
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </CardComposer>
    </div>
  );
}
