'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatRole = 'user' | 'assistant';
type ChatStatus = 'pending' | 'processing' | 'done' | 'error';

type CardChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatStatus;
  replyToId: string | null;
  cardId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function CardChat({ cardId, cardState }: { cardId: string; cardState: string }) {
  const [messages, setMessages] = useState<CardChatMessage[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isShipped = cardState === 'shipped';

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?cardId=${cardId}&limit=100`);
      if (!res.ok) return;
      setMessages(await res.json());
    } catch {}
  }, [cardId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // WebSocket live updates
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4221';
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === 'chat_message' || ev.type === 'chat_message_updated') {
            // Only refetch if the message belongs to this card
            const msg = ev.message as CardChatMessage | undefined;
            if (!msg || msg.cardId === cardId) fetchMessages();
          }
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
  }, [cardId, fetchMessages]);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting || isShipped) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: text.trim(), cardId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to send message');
        setSubmitting(false);
        return;
      }
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      await fetchMessages();
    } catch {
      setError('Network error — please try again.');
    }
    setSubmitting(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }

  return (
    <div className="mt-6 border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 bg-zinc-800/60 border-b border-white/10 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Card Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-[120px] max-h-[400px]">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">No messages yet. Ask a question or leave a note for the agent.</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-violet-600/80 text-white rounded-br-sm'
                  : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
              }`}
            >
              {/* Spinner for pending/processing */}
              {(msg.status === 'pending' || msg.status === 'processing') && msg.role === 'user' && (
                <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2 align-middle" />
              )}
              {msg.role === 'assistant' && (msg.status === 'pending' || msg.status === 'processing') ? (
                <span className="flex items-center gap-2 text-zinc-400">
                  <span className="inline-block w-3 h-3 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                  <span className="text-xs">Thinking…</span>
                </span>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <span>{children}</span> }}>
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!isShipped && (
        <form onSubmit={handleSubmit} className="border-t border-white/10 px-3 py-2 flex gap-2 items-end shrink-0 bg-zinc-900/50">
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
            type="submit"
            disabled={!text.trim() || submitting}
            className="shrink-0 p-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      )}
      {isShipped && (
        <div className="border-t border-white/10 px-4 py-2 text-xs text-zinc-600 text-center shrink-0">
          Card shipped — chat is read-only
        </div>
      )}
      {error && <p className="text-xs text-red-400 px-4 pb-2">{error}</p>}
    </div>
  );
}
