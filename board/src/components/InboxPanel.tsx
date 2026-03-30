'use client';

import { useState, useEffect, useCallback } from 'react';

type Email = {
  id: string;
  messageId: string | null;
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  date: string;
  createdAt: string;
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(d);
    if (diffDays < 7) return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
  } catch {
    return iso;
  }
}

function fmtDateFull(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

// ── Email list item ───────────────────────────────────────────────────────────

function EmailRow({
  email,
  selected,
  onClick,
  onStar,
}: {
  email: Email;
  selected: boolean;
  onClick: () => void;
  onStar: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-zinc-800/60 ${selected ? 'bg-zinc-800' : ''}`}
    >
      <div className="flex items-start gap-2">
        {/* Unread dot */}
        <span className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${email.isRead ? 'bg-transparent' : 'bg-blue-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate text-sm ${email.isRead ? 'text-zinc-400 font-normal' : 'text-zinc-100 font-semibold'}`}>
              {email.fromName || email.fromAddress}
            </span>
            <span className="shrink-0 text-xs text-zinc-500">{fmtDate(email.date)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={`truncate text-xs ${email.isRead ? 'text-zinc-500' : 'text-zinc-300'}`}>
              {email.subject || '(no subject)'}
            </span>
            <button
              type="button"
              onClick={onStar}
              className={`shrink-0 transition-colors ${email.isStarred ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'}`}
              title={email.isStarred ? 'Unstar' : 'Star'}
            >
              <StarIcon filled={email.isStarred} />
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Detail pane ───────────────────────────────────────────────────────────────

function EmailDetail({ email, onStar }: { email: Email; onStar: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-100 leading-snug">{email.subject || '(no subject)'}</h2>
          <button
            type="button"
            onClick={onStar}
            className={`shrink-0 transition-colors ${email.isStarred ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={email.isStarred ? 'Unstar' : 'Star'}
          >
            <StarIcon filled={email.isStarred} />
          </button>
        </div>
        <div className="mt-2 space-y-1 text-xs text-zinc-400">
          <div><span className="text-zinc-500">From: </span><span className="text-zinc-300">{email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress}</span></div>
          <div><span className="text-zinc-500">To: </span><span className="text-zinc-300">{email.toAddresses.join(', ')}</span></div>
          {email.ccAddresses.length > 0 && (
            <div><span className="text-zinc-500">Cc: </span><span className="text-zinc-300">{email.ccAddresses.join(', ')}</span></div>
          )}
          <div><span className="text-zinc-500">Date: </span><span className="text-zinc-300">{fmtDateFull(email.date)}</span></div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {email.bodyHtml ? (
          <iframe
            srcDoc={email.bodyHtml}
            sandbox="allow-same-origin"
            className="w-full h-full border-0"
            title="Email body"
          />
        ) : (
          <pre className="p-4 text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
            {email.bodyText || '(empty)'}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── InboxPanel ────────────────────────────────────────────────────────────────

interface InboxPanelProps {
  open: boolean;
  onClose: () => void;
}

export function InboxPanel({ open, onClose }: InboxPanelProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/emails');
      if (res.ok) setEmails(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchEmails();
  }, [open, fetchEmails]);

  const handleSelect = useCallback(async (email: Email) => {
    setSelected(email);
    if (!email.isRead) {
      // Optimistic update
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
      setSelected(prev => prev?.id === email.id ? { ...prev, isRead: true } : prev);
      await fetch(`/api/emails/${email.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
    }
  }, []);

  const handleStar = useCallback(async (email: Email, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newVal = !email.isStarred;
    // Optimistic update
    setEmails(prev => prev.map(em => em.id === email.id ? { ...em, isStarred: newVal } : em));
    setSelected(prev => prev?.id === email.id ? { ...prev, isStarred: newVal } : prev);
    await fetch(`/api/emails/${email.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isStarred: newVal }),
    });
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/emails/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await fetchEmails();
        // Brief notification via console (could be a toast in future)
        console.info(`Synced ${data.synced} emails`);
      }
    } finally {
      setSyncing(false);
    }
  }, [fetchEmails]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-5xl bg-surface flex flex-col shadow-2xl border-l border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-zinc-100">Inbox</h1>
            {loading && <span className="text-xs text-zinc-500">Loading...</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-white/10 transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Two-pane body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: email list */}
          <div className="w-80 shrink-0 flex flex-col border-r border-border overflow-y-auto">
            {emails.length === 0 && !loading && (
              <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 p-8 text-center">
                No emails. Click Sync to fetch from your IMAP server.
              </div>
            )}
            {emails.map(email => (
              <EmailRow
                key={email.id}
                email={email}
                selected={selected?.id === email.id}
                onClick={() => handleSelect(email)}
                onStar={(e) => handleStar(email, e)}
              />
            ))}
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-hidden">
            {selected ? (
              <EmailDetail
                email={selected}
                onStar={() => handleStar(selected)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-zinc-500">
                Select an email to read
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
