'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatEntry = { role: 'user' | 'assistant'; text: string; timestamp: string };

export function CardChat({ cardId, cardState }: { cardId: string; cardState: string }) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isShipped = cardState === 'shipped';

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting || isShipped) return;
    setSubmitting(true);
    setError(null);
    try {
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
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-zinc-900 border-b border-white/10 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Card Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
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

      {/* Input */}
      {!isShipped ? (
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
      ) : (
        <div className="border-t border-white/10 px-4 py-2 text-xs text-zinc-600 text-center shrink-0">Card shipped — read only</div>
      )}
      {error && <p className="text-xs text-red-400 px-4 pb-2 shrink-0">{error}</p>}
    </div>
  );
}
