'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from './BoardClient';
import { CardComposer } from './CardComposer';
import { ConfirmDialog } from './ConfirmDialog';
import { FileViewerPanel, type ViewerMode } from './FileViewerPanel';
import { useProjects } from '@/contexts/ProjectsContext';
import { useLocale } from '@/contexts/LocaleContext';
import { PRIORITY_TOKENS } from '@/lib/tokens';

type Iteration = {
  id: string;
  cardId: string;
  iterationNumber: number;
  logText: string;
  commitSha: string | null;
  createdAt: string;
};

const TEXT_EXTENSIONS = /\.(txt|md|log|json|ts|tsx|js|jsx|css|html|yaml|yml|sh|bash|toml|env|csv|xml|sql)$/i;

function isTextFile(path: string): boolean {
  return TEXT_EXTENSIONS.test(path);
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

// STATE_LABEL is now derived from t() inside the component



export function CardPanel({
  card,
  onClose,
  onCardUpdate,
  scrollToIterationId,
}: {
  card: Card | null;
  onClose: () => void;
  onCardUpdate?: (updated: Card) => void;
  scrollToIterationId?: string | null;
}) {
  const { t } = useLocale();
  const { projects } = useProjects();
  const demoProject = card?.projectId ? projects.find(p => p.id === card.projectId) ?? null : null;

  function stateLabel(state: string): string {
    const labels: Record<string, string> = {
      backlog: t('backlog'),
      'in-progress': t('inProgress'),
      'in-review': t('inReview'),
      shipped: t('shipped'),
    };
    return labels[state] ?? state;
  }

  // Global settings (fetched once for shipped card links)
  const [boardSettings, setBoardSettings] = useState<{ github_repo: string; github_username: string; vercel_url: string } | null>(null);
  useEffect(() => {
    if (card?.state !== 'shipped') return;
    fetch('/api/settings').then(r => r.json()).then((s: Record<string, string>) => {
      setBoardSettings({
        github_repo: s.github_repo ?? '',
        github_username: s.github_username ?? '',
        vercel_url: s.vercel_url ?? '',
      });
    }).catch(() => {});
  }, [card?.state, card?.id]);

  // File-drop drag state (whole panel)
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileDragCounter = useRef(0);

  // Agent work panel state
  const [agentMessages, setAgentMessages] = useState<{ text: string; timestamp: string }[]>([]);
  const [agentText, setAgentText] = useState<string | null>(null);
  const [bottomHeight, setBottomHeight] = useState<number | null>(null);
  const [isDividerDragging, setIsDividerDragging] = useState(false);
  const panelBodyRef = useRef<HTMLDivElement>(null);
  const dividerDragStartY = useRef(0);
  const dividerDragStartHeight = useRef(0);

  // Inline reopen form state (shipped cards)
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  // Archive confirmation dialog state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Attachment delete confirmation dialog state
  const [deleteAttPath, setDeleteAttPath] = useState<string | null>(null);
  const [deletingAtt, setDeletingAtt] = useState(false);
  const [deleteAttError, setDeleteAttError] = useState<string | null>(null);

  // File viewer panel state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerMode, setViewerMode] = useState<ViewerMode>('file');
  const [viewerFilePath, setViewerFilePath] = useState<string | null>(null);

  // Iterations
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const iterationRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Card ID copy
  const [copied, setCopied] = useState(false);
  const handleCopyId = useCallback(() => {
    if (!card) return;
    navigator.clipboard.writeText(card.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [card]);

  useEffect(() => {
    if (!card) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [card, onClose]);

  // Reset state when card changes
  useEffect(() => {
    setIsFileDragging(false);
    setUploadError(null);
    setReopenError(null);
    setCopied(false);
    setArchiveOpen(false);
    setArchiving(false);
    setArchiveError(null);
    setDeleteAttPath(null);
    setDeletingAtt(false);
    setDeleteAttError(null);
    fileDragCounter.current = 0;
    setViewerOpen(false);
    setViewerFilePath(null);
    setIterations([]);
    iterationRefs.current = {};
  }, [card?.id]);

  // Fetch iterations for the card
  useEffect(() => {
    if (!card?.id) return;
    const cardId = card.id;
    fetch(`/api/cards/${cardId}/iterations`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Iteration[]) => {
        const sorted = [...data].sort((a, b) => a.iterationNumber - b.iterationNumber);
        setIterations(sorted);
      })
      .catch(() => {});
  }, [card?.id]);

  // Scroll to iteration when scrollToIterationId changes
  useEffect(() => {
    if (!scrollToIterationId) return;
    const el = iterationRefs.current[scrollToIterationId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-1', 'ring-violet-500/50');
      setTimeout(() => el.classList.remove('ring-1', 'ring-violet-500/50'), 1500);
    }
  }, [scrollToIterationId, iterations]);

  // Agent text: fetch + poll
  useEffect(() => {
    if (!card?.id) {
      setAgentText(null);
      setAgentMessages([]);
      setBottomHeight(null);
      return;
    }
    setAgentText(null);
    setAgentMessages([]);

    const stored = localStorage.getItem(`card-panel-split-${card.id}`);
    setBottomHeight(stored ? parseInt(stored, 10) : null);

    let cancelled = false;
    const cardId = card.id;

    async function fetchAgentText() {
      try {
        const res = await fetch(`/api/cards/${cardId}/agent-history`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const messages: { text: string; timestamp: string }[] = data.messages ?? [];
        if (cancelled) return;
        setAgentMessages(messages);
        const latest = messages[0]?.text ?? null;
        setAgentText(latest);
        if (latest && !stored) {
          const lineCount = latest.split('\n').length;
          const autoHeight = Math.min(Math.max(lineCount * 20, 80), 320);
          setBottomHeight(prev => (prev !== null ? prev : autoHeight));
        }
      } catch {
        // silently ignore
      }
    }

    fetchAgentText();
    const interval = setInterval(fetchAgentText, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Divider drag
  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dividerDragStartY.current = e.clientY;
    dividerDragStartHeight.current = bottomHeight ?? 160;
    setIsDividerDragging(true);
  }

  useEffect(() => {
    if (!isDividerDragging) return;
    function handleMouseMove(e: MouseEvent) {
      const delta = dividerDragStartY.current - e.clientY;
      const panelH = panelBodyRef.current?.clientHeight ?? 600;
      const newHeight = Math.min(Math.max(dividerDragStartHeight.current + delta, 60), panelH - 80);
      setBottomHeight(newHeight);
    }
    function handleMouseUp(e: MouseEvent) {
      setIsDividerDragging(false);
      if (!card?.id) return;
      const delta = dividerDragStartY.current - e.clientY;
      const panelH = panelBodyRef.current?.clientHeight ?? 600;
      const finalHeight = Math.min(Math.max(dividerDragStartHeight.current + delta, 60), panelH - 80);
      localStorage.setItem(`card-panel-split-${card.id}`, String(finalHeight));
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDividerDragging, card?.id]);

  // Whole-panel file drop handlers
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    fileDragCounter.current += 1;
    setIsFileDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    fileDragCounter.current -= 1;
    if (fileDragCounter.current <= 0) { fileDragCounter.current = 0; setIsFileDragging(false); }
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    fileDragCounter.current = 0;
    setIsFileDragging(false);
    if (!card) return;

    const files = Array.from(e.dataTransfer.files);
    const accepted = files.filter(f => !f.type.startsWith('video/'));
    const rejected = files.filter(f => f.type.startsWith('video/'));

    if (rejected.length > 0) {
      setUploadError(`Videos aren't supported yet. Skipped: ${rejected.map(f => f.name).join(', ')}`);
      if (accepted.length === 0) return;
    } else {
      setUploadError(null);
    }
    if (accepted.length === 0) return;

    setUploading(true);
    let lastUpdated: Card | null = null;
    for (const file of accepted) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`/api/cards/${card.id}/upload`, { method: 'POST', body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setUploadError(`Upload failed for ${file.name}: ${body.error ?? res.statusText}`);
          setUploading(false);
          return;
        }
        lastUpdated = await res.json();
      } catch {
        setUploadError(`Network error uploading ${file.name}`);
        setUploading(false);
        return;
      }
    }
    setUploading(false);
    if (lastUpdated && onCardUpdate) onCardUpdate(lastUpdated);
  }

  async function handleReopen(note: string, files: File[]) {
    if (!card) return;
    if (!note.trim()) { setReopenError('A reopen note is required.'); return; }
    setReopenSubmitting(true);
    setReopenError(null);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`/api/cards/${card.id}/upload`, { method: 'POST', body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setReopenError(`Upload failed for ${file.name}: ${body.error ?? res.statusText}`);
          setReopenSubmitting(false);
          return;
        }
      } catch {
        setReopenError(`Network error uploading ${file.name}`);
        setReopenSubmitting(false);
        return;
      }
    }
    try {
      const res = await fetch(`/api/cards/${card.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'in-progress', note: note.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setReopenError(`Reopen failed: ${body.failures?.join(', ') ?? body.error ?? res.statusText}`);
        setReopenSubmitting(false);
        return;
      }
      const updated: Card = await res.json();
      if (onCardUpdate) onCardUpdate(updated);
    } catch {
      setReopenError(t('networkError'));
      setReopenSubmitting(false);
    }
  }

  async function handleArchiveConfirm() {
    if (!card) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/cards/${card.id}/archive`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setArchiveError(body.error ?? `Archive failed (${res.status})`);
        setArchiving(false);
        return;
      }
      setArchiving(false);
      setArchiveOpen(false);
      onClose();
      if (onCardUpdate) onCardUpdate(await res.json());
    } catch {
      setArchiveError(t('networkError'));
      setArchiving(false);
    }
  }

  function handleOpenFileViewer(path: string) {
    setViewerFilePath(path);
    setViewerMode('file');
    setViewerOpen(true);
  }

  async function handleDeleteAttConfirm() {
    if (!card || !deleteAttPath) return;
    setDeletingAtt(true);
    setDeleteAttError(null);
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeAttachment: deleteAttPath }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteAttError(body.error ?? `Delete failed (${res.status})`);
        setDeletingAtt(false);
        return;
      }
      setDeletingAtt(false);
      setDeleteAttPath(null);
      if (onCardUpdate) onCardUpdate(await res.json());
    } catch {
      setDeleteAttError(t('networkError'));
      setDeletingAtt(false);
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

      {/* File viewer panel — slides in to the left of the card panel */}
      {card && viewerOpen && (
        <FileViewerPanel
          cardId={card.id}
          open={viewerOpen}
          mode={viewerMode}
          filePath={viewerFilePath}
          onClose={() => setViewerOpen(false)}
          onModeChange={setViewerMode}
          onFileSelect={(p) => { setViewerFilePath(p); setViewerMode('file'); }}
        />
      )}

      {/* Card Panel */}
      <div
        className={`absolute inset-y-0 right-0 w-full sm:max-w-xl bg-zinc-900/95 backdrop-blur-md border-l border-white/10 flex flex-col transition-transform duration-300 ${card ? 'translate-x-0' : 'translate-x-full'}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* File-drag overlay — full panel */}
        {isFileDragging && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-blue-950/70 border-2 border-dashed border-blue-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-blue-200 text-base font-semibold">{t('dropToAttach')}</span>
            <span className="text-blue-400 text-xs">{t('dropImagesDocuments')}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold uppercase tracking-wide text-zinc-400 shrink-0">{t('cardDetail')}</span>
            {card && (
              <button
                onClick={handleCopyId}
                title={t('copyCardId')}
                aria-label={t('copyCardId')}
                className="flex items-center gap-1 font-mono text-xs text-zinc-600 hover:text-zinc-300 transition-colors truncate max-w-[min(180px,40vw)]"
              >
                <span className="truncate">{card.id}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 shrink-0 transition-colors ${copied ? 'text-emerald-400' : 'text-zinc-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {copied
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  }
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {card?.workDir && (
              <>
                {/* Git log button */}
                <button
                  onClick={() => { setViewerMode('git'); setViewerOpen(v => viewerMode === 'git' ? !v : true); }}
                  title="Git log"
                  aria-label="Git log"
                  className={`p-1.5 rounded transition-colors ${viewerOpen && viewerMode === 'git' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3M6 20.25V6m0 0a3 3 0 100-6h.008a3 3 0 10-4.026 4.026L6 6z" />
                  </svg>
                </button>
                {/* File tree button */}
                <button
                  onClick={() => { setViewerMode('tree'); setViewerOpen(v => viewerMode === 'tree' ? !v : true); }}
                  title="File tree"
                  className={`p-1.5 rounded transition-colors ${viewerOpen && viewerMode === 'tree' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </button>
              </>
            )}
            {card && (
              <button
                onClick={() => { setArchiveError(null); setArchiveOpen(true); }}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors px-2 py-1 rounded border border-transparent hover:border-red-900/50"
                title={t('archiveCard')}
              >
                {t('archive')}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none"
              aria-label={t('closePanel')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Upload status */}
        {uploading && (
          <div className="px-6 py-2 bg-blue-900/30 border-b border-blue-500/20 text-blue-300 text-sm flex items-center gap-2 shrink-0">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            {t('uploading')}
          </div>
        )}

        {uploadError && (
          <div className="px-6 py-2 bg-red-900/30 border-b border-red-500/20 text-red-300 text-sm flex items-center justify-between gap-2 shrink-0">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* Split content area */}
        <div className="flex-1 flex flex-col min-h-0" ref={panelBodyRef}>

          {/* Top panel — card detail (scrollable) */}
          <div className="flex-1 overflow-y-auto px-7 py-6 min-h-0">
            {card && (
              <>
                {/* Title */}
                <h1 className="text-xl font-semibold text-zinc-100 leading-snug tracking-tight mb-4">
                  {card.title}
                </h1>

                {/* Metadata pills */}
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 border border-white/10 text-zinc-300">
                    {stateLabel(card.state)}
                  </span>
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 border border-white/10 ${PRIORITY_TOKENS[card.priority]?.text ?? PRIORITY_TOKENS['normal'].text}`}>
                    {card.priority}
                  </span>
                  {card.version && (
                    <span className="inline-flex items-center text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300">
                      {card.version}
                    </span>
                  )}
                </div>

                {/* Dates */}
                <div className="flex flex-col gap-1.5 mb-6 text-[13px]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-zinc-600 w-16 shrink-0">{t('created')}</span>
                    <span className="text-zinc-400 font-mono text-xs">{new Date(card.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-zinc-600 w-16 shrink-0">{t('updated')}</span>
                    <span className="text-zinc-400 font-mono text-xs">{new Date(card.updatedAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Timings */}
                {(card.inProgressAt || card.inReviewAt || card.shippedAt) && (() => {
                  const createdMs = new Date(card.createdAt).getTime();
                  return (
                    <div className="mb-6">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-3">{t('timings')}</div>
                      <div className="flex flex-col gap-2">
                        {card.inProgressAt && (() => {
                          const dt = new Date(card.inProgressAt!);
                          return (
                            <div key="ip" className="flex items-baseline gap-2 text-[13px]">
                              <span className="text-zinc-600 w-24 shrink-0">{t('inProgress')}</span>
                              <span className="text-zinc-400 font-mono text-xs">{dt.toLocaleString()}</span>
                              <span className="text-zinc-600 text-xs">+{fmtDuration(dt.getTime() - createdMs)}</span>
                            </div>
                          );
                        })()}
                        {card.inReviewAt && (() => {
                          const dt = new Date(card.inReviewAt!);
                          const base = card.inProgressAt ? new Date(card.inProgressAt).getTime() : createdMs;
                          return (
                            <div key="ir" className="flex items-baseline gap-2 text-[13px]">
                              <span className="text-zinc-600 w-24 shrink-0">{t('inReview')}</span>
                              <span className="text-zinc-400 font-mono text-xs">{dt.toLocaleString()}</span>
                              <span className="text-zinc-600 text-xs">+{fmtDuration(dt.getTime() - base)}</span>
                            </div>
                          );
                        })()}
                        {card.shippedAt && (() => {
                          const dt = new Date(card.shippedAt!);
                          const base = card.inReviewAt ? new Date(card.inReviewAt).getTime() : (card.inProgressAt ? new Date(card.inProgressAt).getTime() : createdMs);
                          return (
                            <div key="sh" className="flex items-baseline gap-2 text-[13px]">
                              <span className="text-zinc-600 w-24 shrink-0">{t('shipped')}</span>
                              <span className="text-zinc-400 font-mono text-xs">{dt.toLocaleString()}</span>
                              <span className="text-zinc-600 text-xs">+{fmtDuration(dt.getTime() - base)} · {fmtDuration(dt.getTime() - createdMs)} total</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {/* GitHub link — shipped cards */}
                {card.state === 'shipped' && (() => {
                  let githubUrl: string | null = null;
                  if (card.commitSha) {
                    if (demoProject) {
                      // Project card: use github_username + repoDir basename
                      const username = boardSettings?.github_username;
                      const repoSlug = demoProject.repoDir.split('/').filter(Boolean).pop();
                      if (username && repoSlug) {
                        githubUrl = `https://github.com/${username}/${repoSlug}/commit/${card.commitSha}`;
                      }
                    } else {
                      // AM board card: use github_repo setting
                      const repo = boardSettings?.github_repo;
                      if (repo) {
                        githubUrl = `https://github.com/${repo}/commit/${card.commitSha}`;
                      }
                    }
                  }
                  if (!githubUrl) return null;
                  return (
                    <div className="mb-6">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-3">GitHub</div>
                      <div className="flex items-center gap-3">
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-700/50 border border-white/10 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
                          </svg>
                          View commit
                        </a>
                        <span className="text-xs text-zinc-600 font-mono truncate">{card.commitSha?.slice(0, 12)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Vercel link — shipped cards */}
                {card.state === 'shipped' && (() => {
                  let vercelUrl: string | null = null;
                  let label = 'Vercel';
                  if (demoProject?.demoUrl) {
                    vercelUrl = demoProject.demoUrl;
                    label = demoProject.demoUrl.startsWith('https://') ? 'Vercel' : 'Demo';
                  } else if (boardSettings?.vercel_url) {
                    vercelUrl = boardSettings.vercel_url;
                  }
                  if (!vercelUrl) return null;
                  return (
                    <div className="mb-6">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-3">{label}</div>
                      <div className="flex items-center gap-3">
                        <a
                          href={vercelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          {label === 'Vercel' ? 'Open app' : 'Open demo'}
                        </a>
                        <span className="text-xs text-zinc-600 font-mono truncate">{vercelUrl}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Token Usage */}
                {card.tokenLogs && card.tokenLogs.length > 0 && (() => {
                  const total = card.tokenLogs.reduce((acc, t) => ({ in: acc.in + t.inputTokens, out: acc.out + t.outputTokens }), { in: 0, out: 0 });
                  function fmtT(n: number) { return n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n/1_000)}K` : String(n); }
                  return (
                    <div className="mb-6">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-3">{t('tokenUsage')}</div>
                      <div className="flex flex-col gap-1 mb-2">
                        {card.tokenLogs.map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
                            <span className="text-zinc-700 w-6 shrink-0">#{t.iter}</span>
                            <span>in: {fmtT(t.inputTokens)}</span>
                            <span className="text-zinc-700">/</span>
                            <span>out: {fmtT(t.outputTokens)}</span>
                            <span className="text-zinc-700">/</span>
                            <span className="text-zinc-400">total: {fmtT(t.inputTokens + t.outputTokens)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono border-t border-white/5 pt-2 text-zinc-400">
                        <span className="text-zinc-600 w-6 shrink-0">∑</span>
                        <span>in: {fmtT(total.in)}</span>
                        <span className="text-zinc-600">/</span>
                        <span>out: {fmtT(total.out)}</span>
                        <span className="text-zinc-600">/</span>
                        <span className="font-semibold">total: {fmtT(total.in + total.out)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Work Log */}
                {card.workLog.length > 0 && (
                  <div className="mb-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-4">{t('workLog')}</div>
                    <div className="flex flex-col gap-5">
                      {card.workLog.map((entry, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                          <span className="font-mono text-[11px] text-zinc-600">{new Date(entry.timestamp).toLocaleString()}</span>
                          <p className="text-sm text-zinc-300 leading-relaxed">{entry.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Iterations */}
                {iterations.length > 0 && (
                  <div className="mb-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-4">Iterations</div>
                    <div className="flex flex-col gap-4">
                      {iterations.map((iter) => (
                        <div
                          key={iter.id}
                          id={`iteration-${iter.id}`}
                          ref={el => { iterationRefs.current[iter.id] = el; }}
                          className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5 bg-zinc-800/40 border border-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-400">iter/{iter.iterationNumber}</span>
                            <span className="text-[11px] text-zinc-600 font-mono">{new Date(iter.createdAt).toLocaleString()}</span>
                            {iter.commitSha && (
                              <span className="text-[10px] font-mono text-zinc-700">{iter.commitSha.slice(0, 7)}</span>
                            )}
                          </div>
                          <div className="prose prose-invert prose-sm max-w-none text-zinc-300 text-sm leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{iter.logText}</ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {card.attachments.length > 0 && (
                  <div className="mb-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-4">{t('attachments')}</div>
                    <div className="flex flex-col gap-3">
                      {card.attachments.map((att) => (
                        <div key={att.path} className="flex flex-col gap-1 group relative">
                          {att.path.match(/\.(png|jpe?g|gif|webp|svg|avif)$/i) ? (
                            /* Image: inline preview */
                            <a href={att.path} target="_blank" rel="noopener noreferrer" className="block overflow-hidden">
                              <img
                                src={att.path}
                                alt={att.name}
                                className="max-h-48 max-w-full rounded border border-white/10 object-contain bg-zinc-800"
                              />
                              <span className="text-xs text-zinc-500 mt-1 block truncate">{att.name}</span>
                            </a>
                          ) : isTextFile(att.path) ? (
                            /* Text file: open in side viewer panel */
                            <button
                              onClick={() => handleOpenFileViewer(att.path)}
                              className={`flex items-center gap-1.5 text-sm text-left w-full group/att transition-colors ${viewerOpen && viewerFilePath === att.path ? 'text-violet-300' : 'text-violet-400 hover:text-violet-200'}`}
                            >
                              <svg className="h-3.5 w-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              <span className="truncate">{att.name}</span>
                              <svg className="h-3 w-3 shrink-0 opacity-0 group-hover/att:opacity-60 transition-opacity ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </button>
                          ) : (
                            /* Other files: plain link */
                            <a
                              href={att.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-violet-400 hover:text-violet-200 text-sm underline truncate"
                            >
                              {att.name}
                            </a>
                          )}
                          {/* Delete button */}
                          <button
                            onClick={() => { setDeleteAttError(null); setDeleteAttPath(att.path); }}
                            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 bg-zinc-900/80 text-zinc-500 hover:text-red-400 rounded px-1 py-0.5 text-xs transition-opacity"
                            title={t('removeAttachment')}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drop hint */}
                <div className="mt-6 border border-dashed border-white/10 rounded-lg px-4 py-5 text-center text-zinc-600 text-sm select-none">
                  {t('dropHint')}
                </div>

                {/* Inline reopen form — shipped cards only */}
                {card.state === 'shipped' && (
                  <div className="mt-6 border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-zinc-800/60 border-b border-white/10">
                      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{t('reopenCard')}</span>
                    </div>
                    <div className="px-4 py-4">
                      <CardComposer
                        placeholder={t('reopenPlaceholder')}
                        submitLabel={t('reopen')}
                        submitting={reopenSubmitting}
                        error={reopenError ?? undefined}
                        onSubmit={handleReopen}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Divider + bottom panel — only when agent text is present */}
          {agentText !== null && (
            <>
              {/* Draggable divider bar */}
              <div
                className={`shrink-0 h-[8px] flex items-center justify-center group transition-colors select-none ${isDividerDragging ? 'bg-violet-600/50' : 'bg-zinc-800 hover:bg-violet-700/40'}`}
                style={{ cursor: 'row-resize' }}
                onMouseDown={handleDividerMouseDown}
              >
                <div className={`w-10 h-[3px] rounded-full transition-colors ${isDividerDragging ? 'bg-violet-400' : 'bg-zinc-600 group-hover:bg-violet-500'}`} />
              </div>

              {/* Bottom panel — agent work */}
              <div
                className="shrink-0 flex flex-col overflow-hidden border-t border-white/5"
                style={{ height: `${bottomHeight ?? 160}px` }}
              >
                <div className="px-6 py-2 border-b border-white/5 shrink-0 bg-zinc-900/80">
                  <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{t('agentWork')}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
                  {agentMessages.map((msg, i) => (
                    <div key={msg.timestamp || i} className={i === 0 ? 'text-zinc-100' : 'text-zinc-500'}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Archive confirmation dialog */}
      {archiveOpen && card && (
        <ConfirmDialog
          title={t('archiveCard')}
          message={`"${card.title}" will be archived and removed from the board.`}
          confirmLabel={t('archive')}
          cancelLabel={t('cancel')}
          error={archiveError}
          submitting={archiving}
          onConfirm={handleArchiveConfirm}
          onCancel={() => { setArchiveOpen(false); setArchiveError(null); }}
        />
      )}

      {/* Attachment delete confirmation dialog */}
      {deleteAttPath && card && (
        <ConfirmDialog
          title={t('deleteAttachment')}
          message={t('deleteCannotBeUndone')}
          confirmLabel={t('delete')}
          cancelLabel={t('cancel')}
          error={deleteAttError}
          submitting={deletingAtt}
          onConfirm={handleDeleteAttConfirm}
          onCancel={() => { setDeleteAttPath(null); setDeleteAttError(null); }}
        />
      )}
    </div>
  );
}
