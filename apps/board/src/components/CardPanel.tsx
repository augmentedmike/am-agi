'use client';

import { useEffect, useRef, useState } from 'react';
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
