'use client';

import { useEffect, useState } from 'react';

type GitHubIssue = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: { name: string; color: string }[];
  assignee: { login: string; avatar_url: string } | null;
  created_at: string;
};

export function IssuesPanel({
  open,
  onClose,
  projectId,
  githubRepo,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  githubRepo: string | null | undefined;
}) {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/github/issues?projectId=${projectId}`)
      .then(r => r.json())
      .then((data: { issues?: GitHubIssue[]; error?: string; reason?: string }) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setIssues(data.issues ?? []);
        setLoading(false);
      })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [open, projectId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="relative pointer-events-auto w-full sm:max-w-md h-full bg-zinc-900/95 backdrop-blur-md border-l border-white/10 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-semibold text-zinc-100">Open Issues</span>
            {githubRepo && (
              <span className="text-xs text-zinc-500 font-mono">{githubRepo}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none"
            aria-label="Close issues panel"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!githubRepo ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm">No GitHub repo configured for this project.</p>
              <p className="text-xs text-zinc-700">Set a repo in Project Settings to enable Issues.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-zinc-500 text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Loading issues…
            </div>
          ) : error ? (
            <div className="text-sm text-red-400 px-2 py-4">{error}</div>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-zinc-600 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No open issues
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {issues.map(issue => (
                <li key={issue.number} className="bg-zinc-800/60 border border-white/8 rounded-lg p-3 hover:bg-zinc-800/80 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-zinc-600 shrink-0 pt-0.5">#{issue.number}</span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-zinc-200 hover:text-white transition-colors leading-snug line-clamp-2"
                      >
                        {issue.title}
                      </a>
                      {issue.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {issue.labels.map(label => (
                            <span
                              key={label.name}
                              className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: `#${label.color}22`,
                                color: `#${label.color}`,
                                border: `1px solid #${label.color}44`,
                              }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {issue.assignee && (
                      <img
                        src={issue.assignee.avatar_url}
                        alt={issue.assignee.login}
                        title={issue.assignee.login}
                        className="h-5 w-5 rounded-full shrink-0 opacity-80"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
