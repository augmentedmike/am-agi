'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card } from './BoardClient';

function ReopenDialog({
  card,
  onClose,
  onReopened,
}: {
  card: Card;
  onClose: () => void;
  onReopened: (updated: Card) => void;
}) {
  const [note, setNote] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleDialogDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }
  function handleDialogDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  }
  function handleDialogDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function handleDialogDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) setScreenshots(prev => [...prev, ...files]);
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) setScreenshots(prev => [...prev, ...files]);
  }
  function removeScreenshot(index: number) {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!note.trim()) { setError('A reopen note is required.'); return; }
    setSubmitting(true);
    setError(null);
    // Upload screenshots first
    for (const file of screenshots) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`/api/cards/${card.id}/upload`, { method: 'POST', body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(`Screenshot upload failed for ${file.name}: ${body.error ?? res.statusText}`);
          setSubmitting(false);
          return;
        }
      } catch {
        setError(`Network error uploading ${file.name}`);
        setSubmitting(false);
        return;
      }
    }
    // Move card to in-progress with note
    try {
      const res = await fetch(`/api/cards/${card.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'in-progress', note: note.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(`Reopen failed: ${body.failures?.join(', ') ?? body.error ?? res.statusText}`);
        setSubmitting(false);
        return;
      }
      const updated: Card = await res.json();
      onReopened(updated);
    } catch {
      setError('Network error — please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-xl shadow-2xl flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Reopen Card</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Reopen Note <span className="text-red-400">*</span>
            </label>
            <textarea
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              rows={4}
              placeholder="Why is this being reopened? What changed or needs revisiting?"
              value={note}
              onChange={e => setNote(e.target.value)}
              autoFocus
            />
          </div>

          {/* Screenshots */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Screenshots (optional)</label>
            <div
              className={`border border-dashed rounded-lg px-4 py-4 text-center text-sm cursor-pointer transition-colors ${isDragging ? 'border-pink-400 bg-pink-900/20 text-pink-300' : 'border-white/10 text-zinc-600 hover:border-white/20 hover:text-zinc-500'}`}
              onDragEnter={handleDialogDragEnter}
              onDragLeave={handleDialogDragLeave}
              onDragOver={handleDialogDragOver}
              onDrop={handleDialogDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              Drop images here or click to browse
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
            </div>
            {screenshots.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                {screenshots.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-800 rounded px-2 py-1">
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => removeScreenshot(i)} className="ml-2 text-zinc-500 hover:text-red-400 shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-300 bg-red-900/30 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium bg-pink-500 hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
            )}
            {submitting ? 'Reopening…' : 'Reopen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function buildMarkdown(card: Card): string {
  const lines: string[] = [];
  lines.push(`# ${card.title}`, '');
  lines.push(`**State:** ${card.state}  `);
  lines.push(`**Priority:** ${card.priority}  `);
  lines.push(`**ID:** \`${card.id}\`  `);
  lines.push(`**Created:** ${new Date(card.createdAt).toLocaleString()}  `);
  lines.push(`**Updated:** ${new Date(card.updatedAt).toLocaleString()}`);
  lines.push('');

  // Timing section
  const createdMs = new Date(card.createdAt).getTime();
  const hasTimings = card.inProgressAt || card.inReviewAt || card.shippedAt;
  if (hasTimings) {
    lines.push('## Timings', '');
    if (card.inProgressAt) {
      const t = new Date(card.inProgressAt);
      const waitMs = t.getTime() - createdMs;
      lines.push(`**In Progress at:** ${t.toLocaleString()} *(waited ${fmtDuration(waitMs)} in backlog)*  `);
    }
    if (card.inReviewAt) {
      const t = new Date(card.inReviewAt);
      const base = card.inProgressAt ? new Date(card.inProgressAt).getTime() : createdMs;
      lines.push(`**In Review at:** ${t.toLocaleString()} *(${fmtDuration(t.getTime() - base)} in-progress)*  `);
    }
    if (card.shippedAt) {
      const t = new Date(card.shippedAt);
      const base = card.inReviewAt ? new Date(card.inReviewAt).getTime() : (card.inProgressAt ? new Date(card.inProgressAt).getTime() : createdMs);
      const totalMs = t.getTime() - createdMs;
      lines.push(`**Shipped at:** ${t.toLocaleString()} *(${fmtDuration(t.getTime() - base)} in-review, ${fmtDuration(totalMs)} total)*  `);
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

export function CardPanel({
  card,
  onClose,
  onCardUpdate,
}: {
  card: Card | null;
  onClose: () => void;
  onCardUpdate?: (updated: Card) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!card) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [card, onClose]);

  // Reset drag state when card changes
  useEffect(() => {
    setIsDragging(false);
    setError(null);
    setShowReopenDialog(false);
    dragCounter.current = 0;
  }, [card?.id]);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (!card) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const nonImages = files.filter(f => !f.type.startsWith('image/'));

    if (nonImages.length > 0) {
      setError(`Only image files are accepted. Skipped: ${nonImages.map(f => f.name).join(', ')}`);
      if (imageFiles.length === 0) return;
    } else {
      setError(null);
    }

    if (imageFiles.length === 0) return;

    setUploading(true);
    let lastUpdated: Card | null = null;

    for (const file of imageFiles) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`/api/cards/${card.id}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(`Upload failed for ${file.name}: ${body.error ?? res.statusText}`);
          setUploading(false);
          return;
        }
        lastUpdated = await res.json();
      } catch (err) {
        setError(`Network error uploading ${file.name}`);
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    if (lastUpdated && onCardUpdate) {
      onCardUpdate(lastUpdated);
    }
  }

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
        className={`absolute inset-y-0 right-0 w-full sm:max-w-xl bg-zinc-900/95 backdrop-blur-md border-l border-white/10 flex flex-col transition-transform duration-300 ${card ? 'translate-x-0' : 'translate-x-full'} ${isDragging ? 'ring-2 ring-violet-500 ring-inset' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-violet-900/40 border-2 border-dashed border-violet-400 rounded pointer-events-none">
            <span className="text-violet-200 text-lg font-semibold">Drop images here</span>
          </div>
        )}

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

        {/* Upload status */}
        {uploading && (
          <div className="px-6 py-2 bg-violet-900/30 border-b border-violet-500/20 text-violet-300 text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            Uploading…
          </div>
        )}

        {error && (
          <div className="px-6 py-2 bg-red-900/30 border-b border-red-500/20 text-red-300 text-sm flex items-center justify-between gap-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {card && (
            <>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{buildMarkdown(card)}</ReactMarkdown>
              </div>

              {/* Attachments */}
              {card.attachments.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">Attachments</h2>
                  <div className="flex flex-col gap-3">
                    {card.attachments.map((att) => (
                      <div key={att.path} className="flex flex-col gap-1">
                        {att.path.match(/\.(png|jpe?g|gif|webp|svg|avif)$/i) ? (
                          <a href={att.path} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={att.path}
                              alt={att.name}
                              className="max-h-48 rounded border border-white/10 object-contain bg-zinc-800"
                            />
                            <span className="text-xs text-zinc-500 mt-1 block truncate">{att.name}</span>
                          </a>
                        ) : (
                          <a
                            href={att.path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:text-violet-200 text-sm underline truncate"
                          >
                            {att.name}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drop hint */}
              <div className="mt-6 border border-dashed border-white/10 rounded-lg px-4 py-5 text-center text-zinc-600 text-sm select-none">
                Drop images here to attach
              </div>

              {/* Reopen button (shipped cards only) */}
              {card.state === 'shipped' && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowReopenDialog(true)}
                    className="w-full px-4 py-2.5 text-sm font-medium bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 hover:border-pink-500/50 text-pink-400 hover:text-pink-300 rounded-lg transition-colors"
                  >
                    ↩ Reopen
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reopen dialog */}
      {showReopenDialog && card && (
        <ReopenDialog
          card={card}
          onClose={() => setShowReopenDialog(false)}
          onReopened={(updated) => {
            setShowReopenDialog(false);
            if (onCardUpdate) onCardUpdate(updated);
          }}
        />
      )}
    </div>
  );
}
