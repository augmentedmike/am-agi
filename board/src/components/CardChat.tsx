'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatEntry = { role: 'user' | 'assistant'; text: string; timestamp: string };

export function CardChat({ cardId, cardState }: { cardId: string; cardState: string }) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const isShipped = cardState === 'shipped';
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/cards/${cardId}/agent-history`);
      if (!res.ok) return;
      const data = await res.json() as { messages: ChatEntry[] };
      setMessages(data.messages ?? []);
    } catch {}
  }, [cardId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

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
  }, []);

  // Auto-scroll or show "new messages" notice when messages change
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setHasNewMessages(true);
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewMessages(false);
    setIsAtBottom(true);
  }

  // Drag handlers
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((!text.trim() && files.length === 0) || submitting || isShipped) return;
    setSubmitting(true);
    setError(null);
    try {
      // First create the message
      const res = await fetch(`/api/cards/${cardId}/agent-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? 'Failed to send');
        setSubmitting(false);
        return;
      }
      // Upload any attached files to the card
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        await fetch(`/api/cards/${cardId}/upload`, { method: 'POST', body: fd });
      }
      setText('');
      setFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
      await fetchMessages();
    } catch {
      setError('Network error — try again.');
    }
    setSubmitting(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-blue-950/70 border-2 border-dashed border-blue-400 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span className="text-blue-200 text-sm font-semibold">Drop to attach</span>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-2 bg-zinc-900 border-b border-white/10 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Card Chat</span>
      </div>

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
            New messages
          </button>
        )}
        <div ref={messagesContainerRef} className="h-full overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-6">No agent activity yet.</p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-violet-600/80 text-white rounded-br-sm'
                  : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
              }`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <span>{children}</span> }}>
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {!isShipped ? (
        <form onSubmit={handleSubmit} className="border-t border-white/10 px-3 py-2 flex flex-col gap-2 shrink-0 bg-zinc-900/50">
          {/* File previews */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <div key={idx} className="relative group">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-14 w-14 object-cover rounded-lg border border-white/10"
                    />
                  ) : (
                    <div className="h-14 w-14 flex items-center justify-center rounded-lg border border-white/10 bg-zinc-800 text-zinc-400 text-xs text-center px-1 overflow-hidden">
                      {file.name.split('.').pop()?.toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-zinc-700 text-zinc-300 hover:bg-red-600 hover:text-white flex items-center justify-center text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              placeholder="Message the agent…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none py-1 max-h-32"
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Attach image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={(!text.trim() && files.length === 0) || submitting}
              className="shrink-0 p-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.md,.csv,.json"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).filter(f => !f.type.startsWith('video/'));
              if (picked.length > 0) setFiles(prev => [...prev, ...picked]);
              e.target.value = '';
            }}
          />
        </form>
      ) : (
        <div className="border-t border-white/10 px-4 py-2 text-xs text-zinc-600 text-center shrink-0">Card shipped — read only</div>
      )}
      {error && <p className="text-xs text-red-400 px-4 pb-2 shrink-0">{error}</p>}
    </div>
  );
}
