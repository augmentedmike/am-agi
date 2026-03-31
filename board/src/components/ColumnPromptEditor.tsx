'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ColumnConfig } from '@/app/api/projects/[id]/column-config/route';

interface Props {
  projectId: string;
  state: string;           // 'backlog' | 'in-progress' | 'in-review' | 'shipped'
  stateLabel: string;      // display name (e.g. "Leads" or "Backlog")
  onClose: () => void;
}

export function ColumnPromptEditor({ projectId, state, stateLabel, onClose }: Props) {
  const [config, setConfig] = useState<ColumnConfig>({ prompt: '', before_hook: '', after_hook: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'prompt' | 'before' | 'after'>('prompt');

  useEffect(() => {
    fetch(`/api/projects/${projectId}/column-config`)
      .then(r => r.json())
      .then((data: Record<string, ColumnConfig>) => {
        setConfig(data[state] ?? { prompt: '', before_hook: '', after_hook: '' });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, state]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/column-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [state]: config }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [projectId, state, config]);

  const content = (
    <div className="fixed inset-0 z-[300] bg-zinc-950/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Column Config</span>
          <span className="text-zinc-700">·</span>
          <span className="text-base font-semibold text-zinc-100">{stateLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-xl leading-none">✕</button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1 px-6 py-2 border-b border-white/5 bg-zinc-900/60">
        {([
          { key: 'prompt', label: 'Agent Prompt', desc: 'What the agent does in this state', color: 'text-violet-300 bg-violet-500/20' },
          { key: 'before', label: 'Before Hook', desc: 'Gate — runs before entering, non-zero blocks', color: 'text-amber-300 bg-amber-500/20' },
          { key: 'after', label: 'After Hook', desc: 'Runs after card enters this state', color: 'text-emerald-300 bg-emerald-500/20' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? t.color : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-3 text-xs text-zinc-600">
          {tab === 'prompt' ? 'Natural language instructions for the agent' :
           tab === 'before' ? 'Shell script — exit 1 to block the transition' :
           'Shell script — runs after card moves to this state'}
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col p-6 gap-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">Loading…</div>
        ) : tab === 'prompt' ? (
          <textarea
            value={config.prompt}
            onChange={e => setConfig(c => ({ ...c, prompt: e.target.value }))}
            className="flex-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none leading-relaxed"
            placeholder="Describe what the agent should do when working on cards in this column…"
            autoFocus
          />
        ) : tab === 'before' ? (
          <textarea
            value={config.before_hook}
            onChange={e => setConfig(c => ({ ...c, before_hook: e.target.value }))}
            className="flex-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none leading-relaxed font-mono"
            placeholder={'#!/bin/bash\n# Gate check — exit 1 to block the transition into this state\n# Available env vars: $CARD_ID, $CARD_TITLE, $WORK_DIR, $PROJECT_ID'}
            autoFocus
          />
        ) : (
          <textarea
            value={config.after_hook}
            onChange={e => setConfig(c => ({ ...c, after_hook: e.target.value }))}
            className="flex-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-5 py-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed font-mono"
            placeholder={'#!/bin/bash\n# Runs after the card enters this state\n# Available env vars: $CARD_ID, $CARD_TITLE, $WORK_DIR, $PROJECT_ID'}
            autoFocus
          />
        )}

        {/* Env var reference */}
        {tab !== 'prompt' && (
          <div className="shrink-0 flex flex-wrap gap-2">
            {['$CARD_ID', '$CARD_TITLE', '$WORK_DIR', '$PROJECT_ID', '$PROJECT_NAME'].map(v => (
              <code key={v} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">{v}</code>
            ))}
            <span className="text-xs text-zinc-600 ml-1 self-center">Available environment variables</span>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
