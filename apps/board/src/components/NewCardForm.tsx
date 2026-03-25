'use client';

import { useState, useEffect, useRef } from 'react';

type Priority = 'AI' | 'critical' | 'high' | 'normal' | 'low';

const TAGS: Priority[] = ['AI', 'critical', 'high', 'normal', 'low'];

const TAG_STYLE: Record<Priority, { active: string; inactive: string }> = {
  AI:       { active: 'bg-violet-500 text-white border border-violet-400',       inactive: 'bg-violet-500/20 text-violet-300 border border-violet-500/30' },
  critical: { active: 'bg-red-500 text-white border border-red-400',             inactive: 'bg-red-500/20 text-red-300 border border-red-500/30' },
  high:     { active: 'bg-orange-500 text-white border border-orange-400',       inactive: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' },
  normal:   { active: 'bg-zinc-500 text-white border border-zinc-400',           inactive: 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30' },
  low:      { active: 'bg-blue-500 text-white border border-blue-400',           inactive: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
};

interface NewCardFormProps {
  onClose: () => void;
}

export function NewCardForm({ onClose }: NewCardFormProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('AI');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const reset = () => {
    setTitle('');
    setPriority('AI');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const body: Record<string, string> = { title: title.trim(), priority };
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || 'Failed to create card.');
        return;
      }
      reset();
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 bg-zinc-800/80 border border-white/10 rounded-xl p-4 flex flex-col gap-3"
    >
      {/* Title */}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={e => { setTitle(e.target.value); setError(''); }}
        placeholder="Card title…"
        className="w-full bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
      />

      {/* Priority tags */}
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

      {/* Error */}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => { reset(); onClose(); }}
          className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="text-xs px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-white font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}
