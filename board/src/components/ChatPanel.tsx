'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FilePreview } from './CardComposer';
import { useProjects } from '@/contexts/ProjectsContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useChat } from '@/contexts/ChatContext';

type ChatRole = 'user' | 'assistant';
type ChatStatus = 'pending' | 'processing' | 'done' | 'error';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatStatus;
  replyToId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

// Render content with [[card:UUID]], [[project:UUID]], and [[iter:UUID]] links and markdown
function ChatContent({
  content,
  onCardOpen,
  onProjectOpen,
  onIterationOpen,
}: {
  content: string;
  onCardOpen: (id: string) => void;
  onProjectOpen: (id: string) => void;
  onIterationOpen: (iterationId: string) => void;
}) {
  const { projects } = useProjects();
  const re = /\[\[(card|project|iteration):([0-9a-f-]{36})\]\]/gi;
  const parts: Array<{ type: 'text' | 'card' | 'project' | 'iteration'; value: string; id?: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: content.slice(last, m.index) });
    parts.push({ type: m[1].toLowerCase() as 'card' | 'project' | 'iteration', value: m[0], id: m[2] });
    last = re.lastIndex;
  }
  if (last < content.length) parts.push({ type: 'text', value: content.slice(last) });

  return (
    <span>
      {parts.map((p, i) => {
        if (p.type === 'card') {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCardOpen(p.id!)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 transition-colors font-mono"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {p.id!.slice(0, 8)}
            </button>
          );
        }
        if (p.type === 'project') {
          const proj = projects.find(pr => pr.id === p.id);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onProjectOpen(p.id!)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors font-mono"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {proj?.name ?? p.id!.slice(0, 8)}
            </button>
          );
        }
        if (p.type === 'iteration') {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onIterationOpen(p.id!)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors font-mono"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              iter/{p.id!.slice(0, 8)}
            </button>
          );
        }
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <span>{children}</span> }}>
            {p.value}
          </ReactMarkdown>
        );
      })}
    </span>
  );
}

function CopyButton({ text, title = 'Copy' }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title={title}
      className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${copied ? 'text-emerald-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {copied
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        }
      </svg>
    </button>
  );
}

function ReplyButton({ onClick, title = 'Reply' }: { onClick: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
      </svg>
    </button>
  );
}

export function ChatPanel({
  open,
  onClose,
  onCardOpen,
  onIterationOpen,
}: {
  open: boolean;
  onClose: () => void;
  onCardOpen: (cardId: string) => void;
  onIterationOpen?: (iterationId: string) => void;
}) {
  const { switchProject, projects } = useProjects();
  const { t } = useLocale();
  const { chatPrefill } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const projectSelectorRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?limit=50');
      if (!res.ok) return;
      setMessages(await res.json());
    } catch {}
  }, []);

  // Restore draft and selected project after mount (avoids SSR mismatch)
  useEffect(() => {
    try { const d = localStorage.getItem('am:chat:draft'); if (d) setText(d); } catch {}
    try { const p = localStorage.getItem('am:chat:project'); if (p) setSelectedProjectId(p); } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchMessages();
    // Poll as fallback (covers cases where WS isn't connected)
    pollingRef.current = setInterval(fetchMessages, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [open, fetchMessages]);

  // WebSocket for instant updates
  useEffect(() => {
    if (!open) return;
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4221';
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === 'chat_message' || ev.type === 'chat_message_updated') fetchMessages();
        } catch {}
      };
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => { ws.close(); };
    }

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [open, fetchMessages]);

  // Track whether the user is scrolled to the bottom
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    function onScroll() {
      const atBottom = el!.scrollHeight - el!.scrollTop - el!.clientHeight < 60;
      setIsAtBottom(atBottom);
      if (atBottom) setHasNewMessages(false);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [open]);

  // Auto-scroll or show arrow when messages change
  useEffect(() => {
    if (!open) return;
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setHasNewMessages(true);
    }
  }, [messages, open]); // eslint-disable-line react-hooks/exhaustive-deps

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewMessages(false);
    setIsAtBottom(true);
  }

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Close project selector on outside click
  useEffect(() => {
    if (!projectSelectorOpen) return;
    function handleClick(e: MouseEvent) {
      if (projectSelectorRef.current && !projectSelectorRef.current.contains(e.target as Node)) {
        setProjectSelectorOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [projectSelectorOpen]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => textareaRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [open]);

  // Apply prefill when panel opens with a prefill value
  useEffect(() => {
    if (!open || !chatPrefill) return;
    setText(chatPrefill);
    try { localStorage.setItem('am:chat:draft', chatPrefill); } catch {}
  }, [open, chatPrefill]);

  // Panel-level drag handlers
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
    const dropped = Array.from(e.dataTransfer.files).filter(f => !f.type.startsWith('video/'));
    if (dropped.length > 0) setFiles(prev => [...prev, ...dropped]);
  }

  function addFiles(incoming: FileList | File[]) {
    const accepted = Array.from(incoming).filter(f => !f.type.startsWith('video/'));
    if (accepted.length > 0) setFiles(prev => [...prev, ...accepted]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // plain Enter = new line (default textarea behavior, no preventDefault)
  }

  async function handleSubmit() {
    if (!text.trim() && files.length === 0) return;
    setError(null);
    const messageText = text.trim();
    const messageReplyTo = replyTo;

    // Clear input immediately — don't wait for the network
    setText('');
    try { localStorage.removeItem('am:chat:draft'); } catch {}
    setFiles([]);
    setReplyTo(null);
    textareaRef.current?.focus();

    // Optimistic message — show immediately, replace on server confirm
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      role: 'user',
      content: messageText,
      status: 'pending',
      replyToId: messageReplyTo?.id ?? null,
      projectId: selectedProjectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    setSubmitting(true);
    try {
      const body: Record<string, string | null> = { role: 'user', content: messageText };
      if (selectedProjectId) body.projectId = selectedProjectId;
      if (messageReplyTo) body.replyToId = messageReplyTo.id;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to send');
      await fetchMessages();
    } catch {
      setError(t('failedToSend'));
      setText(messageText); // restore on failure so user doesn't lose their message
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    } finally {
      setSubmitting(false);
    }
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');

  async function handleEditSubmit() {
    if (!editingId || !editText.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/chat/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editText.trim(), status: 'pending' }),
      });
      setEditingId(null);
      setEditText('');
      await fetchMessages();
      textareaRef.current?.focus();
    } catch {
      setError(t('failedToUpdate'));
    } finally {
      setSubmitting(false);
    }
  }

  function scrollToMessage(id: string) {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-1', 'ring-pink-500/40');
      setTimeout(() => el.classList.remove('ring-1', 'ring-pink-500/40'), 1500);
    }
  }

  const msgMap = Object.fromEntries(messages.map(m => [m.id, m]));
  const isProcessing = messages.some(m => m.status === 'pending' || m.status === 'processing');
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }
  const tokenCount = Math.round(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const imageCount = messages.filter(m => m.content.includes('data:image') || m.content.includes('![')).length;

  return (
    <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />

      {/* Panel — whole panel is the drop target */}
      <div
        className={`absolute bottom-0 right-0 w-full sm:max-w-lg bg-zinc-900/95 backdrop-blur-md border-l border-white/10 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ top: 'var(--nav-height)' }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drop overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-blue-950/70 border-2 border-dashed border-blue-400 pointer-events-none rounded-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-blue-200 font-semibold">{t('dropToAttach')}</span>
          </div>
        )}

        {/* Header — slim strip locked to the bottom of the nav bar */}
        <div className="shrink-0 px-3 border-b border-white/10 flex items-center gap-2" style={{ height: '32px' }}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{t('chatHeader')}</span>
          {isProcessing && (
            <svg className="animate-spin h-3 w-3 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          )}
          {/* Project selector */}
          <div className="relative" ref={projectSelectorRef}>
            <button
              type="button"
              onClick={() => setProjectSelectorOpen(v => !v)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${selectedProjectId ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30' : 'text-zinc-600 hover:text-zinc-400 bg-zinc-800/60 hover:bg-zinc-800'}`}
              title="Focus on a project"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="max-w-[80px] truncate">
                {selectedProjectId ? (projects.find(p => p.id === selectedProjectId)?.name ?? 'project') : 'all'}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {projectSelectorOpen && (
              <div className="absolute top-full left-0 mt-0.5 z-50 bg-zinc-900 border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px] max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setSelectedProjectId(null); try { localStorage.removeItem('am:chat:project'); } catch {} setProjectSelectorOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${!selectedProjectId ? 'text-zinc-200 bg-zinc-800' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                >
                  All projects
                </button>
                {projects.filter(p => !p.isTest).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedProjectId(p.id); try { localStorage.setItem('am:chat:project', p.id); } catch {} setProjectSelectorOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors truncate ${selectedProjectId === p.id ? 'text-violet-300 bg-violet-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1" />
          <span className="text-[10px] text-zinc-600 tabular-nums">{messages.length}|{tokenCount}|{imageCount}</span>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/chat', { method: 'DELETE' });
              setMessages([]);
            }}
            className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
            title="Clear chat"
          >
            clear
          </button>
          <button
            type="button"
            onClick={() => searchOpen ? closeSearch() : openSearch()}
            className={`p-0.5 rounded transition-colors shrink-0 ${searchOpen ? 'text-pink-400' : 'text-zinc-500 hover:text-zinc-200'}`}
            title={t('search')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </button>
          <button onClick={onClose} className="p-0.5 rounded text-zinc-500 hover:text-zinc-200 transition-colors shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="shrink-0 px-3 py-1.5 border-b border-white/10 flex items-center gap-2 bg-zinc-900/60">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchMessages')}
              className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none"
              onKeyDown={e => { if (e.key === 'Escape') closeSearch(); }}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="text-zinc-600 hover:text-zinc-300 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="relative flex-1 min-h-0">
        {hasNewMessages && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium shadow-lg transition-colors animate-bounce"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {t('newMessages')}
          </button>
        )}
        <div ref={messagesContainerRef} className="h-full overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {messages.length === 0 && (
            <p className="text-sm text-zinc-600 text-center pt-8">
              {t('noMessagesYet')}
            </p>
          )}
          {messages.length > 0 && searchQuery.trim() && filteredMessages.length === 0 && (
            <p className="text-sm text-zinc-600 text-center pt-8">
              {t('noMessagesMatch')}
            </p>
          )}

          {filteredMessages.map((msg) => {
            const isLastUser = msg.id === lastUserMsg?.id;
            const replyTarget = msg.replyToId ? msgMap[msg.replyToId] : null;

            return (
              <div
                key={msg.id}
                ref={el => { messageRefs.current[msg.id] = el; }}
                className="flex flex-col gap-1 rounded-lg"
              >
                {/* Reply context */}
                {replyTarget && (
                  <button
                    type="button"
                    onClick={() => scrollToMessage(replyTarget.id)}
                    className="self-start flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors bg-zinc-800/50 rounded px-2 py-0.5 border border-white/5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    <span className="truncate max-w-[min(220px,45vw)]">{replyTarget.content.slice(0, 70)}{replyTarget.content.length > 70 ? '…' : ''}</span>
                  </button>
                )}

                {/* Row: sender + timestamp + status + actions */}
                <div className="flex items-center gap-2 group">
                  <span className={`text-xs font-semibold ${msg.role === 'user' ? 'text-zinc-300' : 'text-pink-400'}`}>
                    {msg.role === 'user' ? t('you') : t('am')}
                  </span>
                  <span className="text-[10px] text-zinc-700">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.status === 'pending' && <span className="text-[10px] text-amber-600">{t('sendingStatus')}</span>}
                  {msg.status === 'processing' && <span className="text-[10px] text-blue-500">{t('workingStatus')}</span>}
                  {msg.status === 'error' && <span className="text-[10px] text-red-500">{t('errorStatus')}</span>}

                  <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {msg.role === 'assistant' && <CopyButton text={msg.content} title={t('copy')} />}
                    {msg.role === 'assistant' && <ReplyButton onClick={() => setReplyTo(msg)} title={t('replyTitle')} />}
                    {msg.role === 'user' && isLastUser && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setEditingId(msg.id); setEditText(msg.content); }}
                          title={t('editResendTitle')}
                          className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/chat/${msg.id}`, { method: 'DELETE' });
                            await fetchMessages();
                          }}
                          title="Delete message"
                          className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Message body */}
                {editingId === msg.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="w-full bg-zinc-800 border border-white/10 rounded px-2 py-1.5 text-sm text-zinc-100 resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
                      rows={3}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
                        if (e.key === 'Escape') { setEditingId(null); setEditText(''); textareaRef.current?.focus(); }
                      }}
                    />
                    <p className="text-[10px] text-zinc-600">{t('shiftEnterResend')}</p>
                  </div>
                ) : (
                  <div className={`text-sm rounded-lg px-3 py-2 ${msg.role === 'user' ? 'bg-zinc-800/60 text-zinc-200' : 'bg-zinc-800/30 text-zinc-100'}`}>
                    {msg.role === 'assistant' ? (
                      <>
                        <div className="prose prose-sm prose-invert max-w-none break-words">
                          <ChatContent content={msg.content} onCardOpen={onCardOpen} onProjectOpen={(id) => { switchProject(id); onClose(); }} onIterationOpen={onIterationOpen ?? (() => {})} />
                        </div>
                        {/* Bottom actions */}
                        <div className="flex items-center gap-0.5 mt-2 pt-1.5 border-t border-white/5">
                          <CopyButton text={msg.content} title={t('copy')} />
                          <ReplyButton onClick={() => setReplyTo(msg)} title={t('replyTitle')} />
                        </div>
                      </>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
        </div>

        {/* Reply indicator */}
        {replyTo && (
          <div className="shrink-0 mx-4 mb-1 flex items-center gap-2 bg-zinc-800/60 border border-white/10 rounded px-3 py-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
            <span className="text-xs text-zinc-500 truncate flex-1">
              {replyTo.content.slice(0, 80)}{replyTo.content.length > 80 ? '…' : ''}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-zinc-600 hover:text-zinc-300 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Composer — no send button, Shift+Enter to send */}
        <div className="shrink-0 px-4 pb-4 pt-2 border-t border-white/10 flex flex-col gap-2">
          <div className="flex items-center gap-3 text-[10px] text-zinc-600">
            <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono">Enter</kbd> {t('newLine')}</span>
            <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono">Shift ⏎</kbd> {t('shiftEnterSend')}</span>
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <FilePreview key={i} file={f} onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => { setText(e.target.value); try { localStorage.setItem('am:chat:draft', e.target.value); } catch {} autoResize(); }}
              onInput={autoResize}
              onKeyDown={handleKeyDown}
              placeholder={replyTo ? t('replyPlaceholder') : t('chatPlaceholder')}
              disabled={submitting}
              className="w-full bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
              style={{ minHeight: '6rem', overflowY: 'hidden' }}
            />
            {/* Attach button — bottom-left inside textarea area */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2.5 left-2.5 text-zinc-600 hover:text-zinc-400 transition-colors p-0.5 rounded"
              title={t('attachFiles')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.md,.csv,.json"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      </div>
    </div>
  );
}
