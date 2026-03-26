'use client';

import { useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

// ── Types ────────────────────────────────────────────────────────────────────

export type ViewerMode = 'file' | 'git' | 'tree';

type GitCommit = {
  sha: string;
  subject: string;
  author: string;
  ago: string;
  date: string;
};

type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}K`;
  return `${(n / 1024 / 1024).toFixed(1)}M`;
}

const TEXT_RE = /\.(txt|md|ts|tsx|js|jsx|json|yaml|yml|sh|bash|toml|env|cfg|conf|py|rb|go|rs|java|c|cpp|h|css|html|xml|sql|log|gitignore|prettierrc|eslintrc)$/i;

function isText(p: string) { return TEXT_RE.test(p); }

// ── File tree node ───────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  onFileClick,
}: {
  node: FileNode;
  depth: number;
  onFileClick: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 14;

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 w-full text-left py-0.5 pr-2 hover:bg-white/5 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
          style={{ paddingLeft: `${indent + 4}px` }}
        >
          <svg className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <svg className="h-3.5 w-3.5 shrink-0 text-amber-400/70" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="text-xs truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <div>
            {node.children.map(child => (
              <TreeNode key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const clickable = isText(node.path);
  return (
    <button
      onClick={() => clickable && onFileClick(node.path)}
      disabled={!clickable}
      className={`flex items-center gap-1.5 w-full text-left py-0.5 pr-2 rounded transition-colors ${clickable ? 'hover:bg-white/5 text-violet-300 hover:text-violet-100 cursor-pointer' : 'text-zinc-500 cursor-default'}`}
      style={{ paddingLeft: `${indent + 4 + 12}px` }}
    >
      <svg className="h-3.5 w-3.5 shrink-0 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <span className="text-xs truncate flex-1">{node.name}</span>
      {node.size !== undefined && (
        <span className="text-[10px] text-zinc-700 shrink-0">{fmtBytes(node.size)}</span>
      )}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function FileViewerPanel({
  cardId,
  open,
  mode,
  filePath,
  onClose,
  onModeChange,
  onFileSelect,
}: {
  cardId: string;
  open: boolean;
  mode: ViewerMode;
  filePath: string | null;
  onClose: () => void;
  onModeChange: (m: ViewerMode) => void;
  onFileSelect: (path: string) => void;
}) {
  // ── file content state
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // ── git state
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branch, setBranch] = useState('');
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);

  // ── file tree state
  const [tree, setTree] = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Load file content
  const loadFile = useCallback(async (path: string) => {
    setFileLoading(true);
    setFileError(null);
    setFileContent(null);
    try {
      const url = path.startsWith('/uploads/') ? path : `/api/file?path=${encodeURIComponent(path)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setFileContent(await res.text());
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setFileLoading(false);
    }
  }, []);

  // Load git log
  const loadGit = useCallback(async () => {
    setGitLoading(true);
    setGitError(null);
    try {
      const res = await fetch(`/api/cards/${cardId}/git`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `${res.status}`);
      }
      const data = await res.json();
      setCommits(data.commits ?? []);
      setBranch(data.branch ?? '');
    } catch (e) {
      setGitError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setGitLoading(false);
    }
  }, [cardId]);

  // Load file tree
  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    setTreeError(null);
    try {
      const res = await fetch(`/api/cards/${cardId}/files`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `${res.status}`);
      }
      const data = await res.json();
      setTree(data.tree ?? []);
    } catch (e) {
      setTreeError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setTreeLoading(false);
    }
  }, [cardId]);

  // Trigger loads when mode/file changes
  useEffect(() => {
    if (!open) return;
    if (mode === 'file' && filePath) loadFile(filePath);
    if (mode === 'git' && commits.length === 0) loadGit();
    if (mode === 'tree' && tree.length === 0) loadTree();
  }, [open, mode, filePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload git/tree when card changes
  useEffect(() => {
    setCommits([]);
    setBranch('');
    setTree([]);
  }, [cardId]);

  const fileName = filePath ? filePath.split('/').pop() ?? filePath : null;
  const isMd = filePath?.match(/\.md$/i);

  return (
    <div
      className={`absolute inset-y-0 right-0 sm:right-[min(576px,100vw)] w-full sm:w-[520px] bg-zinc-950/98 border-l border-white/10 flex flex-col transition-transform duration-300 z-10 ${open ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 gap-2">
        {/* Mode tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onModeChange('file')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${mode === 'file' ? 'bg-violet-500/20 text-violet-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {fileName ? <span className="max-w-[100px] truncate">{fileName}</span> : 'File'}
          </button>
          <button
            onClick={() => { onModeChange('git'); if (commits.length === 0) loadGit(); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${mode === 'git' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3M6 20.25V6m0 0a3 3 0 100-6h.008a3 3 0 10-4.026 4.026L6 6z" />
            </svg>
            Git
          </button>
          <button
            onClick={() => { onModeChange('tree'); if (tree.length === 0) loadTree(); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${mode === 'tree' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            Files
          </button>
        </div>

        <div className="flex items-center gap-1">
          {mode === 'git' && (
            <button onClick={loadGit} title="Refresh" className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          )}
          {mode === 'tree' && (
            <button onClick={loadTree} title="Refresh" className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none" aria-label="Close viewer">
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── File mode ── */}
        {mode === 'file' && (
          <div className="h-full">
            {!filePath ? (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                Select a file to view
              </div>
            ) : fileLoading ? (
              <div className="flex items-center justify-center gap-2 h-32 text-zinc-500 text-sm">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Loading…
              </div>
            ) : fileError ? (
              <div className="px-4 py-4 text-red-400 text-sm">{fileError}</div>
            ) : isMd ? (
              <div className="px-5 py-4 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{fileContent ?? ''}</ReactMarkdown>
              </div>
            ) : (
              <pre className="px-4 py-4 text-xs text-zinc-300 font-mono whitespace-pre leading-relaxed overflow-x-auto">
                {fileContent ?? ''}
              </pre>
            )}
          </div>
        )}

        {/* ── Git mode ── */}
        {mode === 'git' && (
          <div className="px-2 py-2">
            {gitLoading ? (
              <div className="flex items-center justify-center gap-2 h-32 text-zinc-500 text-sm">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Loading…
              </div>
            ) : gitError ? (
              <div className="px-3 py-4 text-red-400 text-sm">{gitError}</div>
            ) : commits.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">No commits yet.</div>
            ) : (
              <>
                {branch && (
                  <div className="flex items-center gap-1.5 px-3 py-2 mb-2">
                    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
                    </svg>
                    <span className="text-xs font-mono text-emerald-400">{branch}</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  {commits.map((c, i) => (
                    <div key={c.sha} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/5 group">
                      {/* Graph dot */}
                      <div className="flex flex-col items-center shrink-0 mt-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/70 group-hover:bg-emerald-400 shrink-0" />
                        {i < commits.length - 1 && <div className="w-px flex-1 bg-white/10 mt-1" style={{ minHeight: '16px' }} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-200 leading-snug break-words">{c.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[10px] text-zinc-600">{c.sha.slice(0, 7)}</span>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-[10px] text-zinc-500">{c.author}</span>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-[10px] text-zinc-600">{c.ago}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── File tree mode ── */}
        {mode === 'tree' && (
          <div className="px-2 py-2 font-mono">
            {treeLoading ? (
              <div className="flex items-center justify-center gap-2 h-32 text-zinc-500 text-sm">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Loading…
              </div>
            ) : treeError ? (
              <div className="px-3 py-4 text-red-400 text-sm">{treeError}</div>
            ) : tree.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">Empty directory.</div>
            ) : (
              tree.map(node => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  onFileClick={p => { onFileSelect(p); onModeChange('file'); }}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
