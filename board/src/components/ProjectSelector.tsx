'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { pinyin } from 'pinyin-pro';
import type { Project } from './BoardClient';
import { useLocale } from '@/contexts/LocaleContext';
import { AM_BOARD_PROJECT_ID } from '@/lib/constants';

const LS_KEY = 'am_show_test_projects';

const WORKSPACE_BASE = '~/am/workspaces';

const TEMPLATE_OPTIONS = [
  { id: 'blank',             icon: '📄', labelKey: 'templateBlankName',   descKey: 'templateBlankDesc',   category: 'blank' },
  { id: 'sales-outbound',    icon: '💼', labelKey: 'templateSalesName',   descKey: 'templateSalesDesc',   category: 'Workflows' },
  { id: 'content-marketing', icon: '📅', labelKey: 'templateContentName', descKey: 'templateContentDesc', category: 'Workflows' },
  { id: 'customer-support',  icon: '🎧', labelKey: 'templateSupportName', descKey: 'templateSupportDesc', category: 'Workflows' },
  { id: 'next-app',          icon: '▲',  labelKey: 'templateNextAppName', descKey: 'templateNextAppDesc', category: 'Build' },
  { id: 'bun-lib',           icon: '🐇', labelKey: 'templateBunLibName',  descKey: 'templateBunLibDesc',  category: 'Build' },
] as const;

const TEMPLATE_GALLERY_GROUPS = ['Workflows', 'Build'] as const;

// CJK Unified Ideographs + Extensions + Compatibility
const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF\u{20000}-\u{2A6DF}]/u;

function slugify(name: string): string {
  // Transliterate CJK characters to pinyin before slugifying
  const ascii = CJK_RE.test(name)
    ? pinyin(name, { toneType: 'none', separator: ' ', nonZh: 'consecutive' })
    : name;
  return ascii
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip combining accents (é→e etc.)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function TemplateCard({ tpl, selected, onSelect }: {
  tpl: typeof TEMPLATE_OPTIONS[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col gap-3 p-6 rounded-xl border text-left transition-all ${
        selected
          ? 'border-pink-500 ring-2 ring-pink-500 bg-pink-500/10 text-zinc-100'
          : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100'
      }`}
    >
      <span className="text-4xl leading-none">{tpl.icon}</span>
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold leading-snug">{t(tpl.labelKey as Parameters<typeof t>[0])}</span>
        <span className="text-sm text-zinc-400 leading-snug">{t(tpl.descKey as Parameters<typeof t>[0])}</span>
      </div>
    </button>
  );
}

function CreateProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Project) => void }) {
  const { t } = useLocale();
  const [step, setStep] = useState<1 | 2>(1);
  const [templateType, setTemplateType] = useState<string>('blank');
  const [name, setName] = useState('');
  const [versioned, setVersioned] = useState(false);
  const [githubRepo, setGithubRepo] = useState('');
  const [vercelUrl, setVercelUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const slug = slugify(name);
  const repoDir = slug ? `${WORKSPACE_BASE}/${slug}` : '';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t('nameRequired')); return; }
    setError('');
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), repoDir, versioned, templateType };
      if (githubRepo.trim()) body.githubRepo = githubRepo.trim();
      if (vercelUrl.trim()) body.vercelUrl = vercelUrl.trim();
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) { setError(t('duplicateProject')); return; }
      if (!res.ok) { setError(t('failedToCreate')); return; }
      onCreate(await res.json());
    } catch {
      setError(t('networkErrorShort'));
    } finally {
      setSubmitting(false);
    }
  }

  const blankTpl = TEMPLATE_OPTIONS.find(tpl => tpl.id === 'blank')!;

  const modal = (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-8 py-5 border-b border-white/10 bg-zinc-900/95">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
            {t('newProject')}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-sm font-semibold text-zinc-200">
            {step === 1 ? t('stepSelectTemplate') : t('stepProjectDetails')}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Step indicators */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${step === 1 ? 'bg-pink-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>1</span>
            <span className="text-zinc-600 text-xs">—</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${step === 2 ? 'bg-pink-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>2</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-xl leading-none ml-2">✕</button>
        </div>
      </div>

      {/* Step 1: Template Gallery */}
      {step === 1 && (
        <div className="flex-1 overflow-y-auto bg-zinc-900/95">
          <div className="max-w-4xl mx-auto px-8 py-10">
            {/* Blank — always first */}
            <div className="mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <TemplateCard
                  tpl={blankTpl}
                  selected={templateType === 'blank'}
                  onSelect={() => setTemplateType('blank')}
                />
              </div>
            </div>

            {/* Grouped sections */}
            {TEMPLATE_GALLERY_GROUPS.map(group => {
              const groupTpls = TEMPLATE_OPTIONS.filter(tpl => tpl.category === group);
              return (
                <div key={group} className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                      {group === 'Workflows' ? t('categoryWorkflows') : t('categoryBuild')}
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {groupTpls.map(tpl => (
                      <TemplateCard
                        key={tpl.id}
                        tpl={tpl}
                        selected={templateType === tpl.id}
                        onSelect={() => setTemplateType(tpl.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Continue */}
            <div className="flex justify-end pt-4 border-t border-white/5">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 text-sm font-medium bg-pink-500 hover:bg-pink-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {t('continueButton')}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Project Details */}
      {step === 2 && (
        <div className="flex-1 overflow-y-auto bg-zinc-900/95">
          <div className="max-w-lg mx-auto px-8 py-10">
            {/* Selected template summary */}
            {(() => {
              const sel = TEMPLATE_OPTIONS.find(tpl => tpl.id === templateType);
              return sel ? (
                <div className="flex items-center gap-3 mb-8 px-4 py-3 rounded-lg bg-zinc-800/60 border border-white/5">
                  <span className="text-2xl">{sel.icon}</span>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">{t('templatePickerLabel')}</p>
                    <p className="text-sm font-medium text-zinc-200">{t(sel.labelKey as Parameters<typeof t>[0])}</p>
                  </div>
                </div>
              ) : null;
            })()}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  placeholder={t('myProject')}
                  autoFocus
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('workDirectory')}</label>
                <div className="bg-zinc-800/50 border border-white/5 rounded-lg px-4 py-2.5 font-mono text-sm text-zinc-500 select-all">
                  {repoDir || <span className="text-zinc-700">~/am/workspaces/project-name</span>}
                </div>
                <p className="text-xs text-zinc-600">Auto-generated from project name — created on first agent run</p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={versioned}
                  onChange={e => setVersioned(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-zinc-800 text-pink-500 focus:ring-pink-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm text-zinc-300">{t('versioned')}</span>
                <span className="text-xs text-zinc-600">{t('versionedHint')}</span>
              </label>

              <div className="flex flex-col gap-3 pt-1 border-t border-white/5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('githubRepoLabel')}</label>
                  <input
                    type="text"
                    value={githubRepo}
                    onChange={e => setGithubRepo(e.target.value)}
                    placeholder="owner/repo"
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('vercelUrlLabel')}</label>
                  <input
                    type="url"
                    value={vercelUrl}
                    onChange={e => setVercelUrl(e.target.value)}
                    placeholder="https://your-app.vercel.app"
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-300 bg-red-900/30 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {t('back')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !slug}
                  className="px-6 py-2.5 text-sm font-medium bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {submitting ? t('creating') : t('createProject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}

interface ProjectSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
  projects: Project[];
  onProjectCreated: (p: Project) => void;
  onOpenProjectSettings?: (projectId: string) => void;
}

export function ProjectSelector({ selectedId, onSelect, projects, onProjectCreated, onOpenProjectSettings }: ProjectSelectorProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [hiddenProjects, setHiddenProjects] = useState<string[]>([AM_BOARD_PROJECT_ID]);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, string>) => {
        try {
          setHiddenProjects(JSON.parse(s.hidden_projects || '["am-board-0000-0000-0000-000000000000"]'));
        } catch {
          setHiddenProjects([AM_BOARD_PROJECT_ID]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleSettingsChanged() {
      fetch('/api/settings')
        .then(r => r.json())
        .then((s: Record<string, string>) => {
          try {
            setHiddenProjects(JSON.parse(s.hidden_projects || '["am-board-0000-0000-0000-000000000000"]'));
          } catch {
            setHiddenProjects([AM_BOARD_PROJECT_ID]);
          }
        })
        .catch(() => {});
    }
    window.addEventListener('settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('settings-changed', handleSettingsChanged);
  }, []);

  const handleToggle = useCallback(() => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(v => !v);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inButton = buttonRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inButton && !inDropdown) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Never show test projects; respect hidden_projects setting
  const showAmBoard = !hiddenProjects.includes(AM_BOARD_PROJECT_ID);
  const visibleProjects = projects.filter(p => !p.isTest && p.id !== AM_BOARD_PROJECT_ID && !hiddenProjects.includes(p.id));

  const selected = projects.find(p => p.id === selectedId);

  const dropdown = open && dropdownPos ? createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
      className="w-56 bg-zinc-800 border border-white/10 rounded-lg shadow-xl py-1 overflow-hidden"
    >
      {/* AM Board entry — only shown when not in hidden_projects */}
      {showAmBoard && (
        <button
          onClick={() => { onSelect(AM_BOARD_PROJECT_ID); setOpen(false); }}
          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${selectedId === AM_BOARD_PROJECT_ID ? 'bg-pink-500/10 text-pink-300' : 'text-zinc-200 hover:bg-zinc-700/60'}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" style={{ opacity: selectedId === AM_BOARD_PROJECT_ID ? 1 : 0 }} />
          HelloAm!
        </button>
      )}

      {/* All projects view */}
      <button
        onClick={() => { onSelect('__all__'); setOpen(false); }}
        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${selectedId === '__all__' ? 'bg-pink-500/10 text-pink-300' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        All projects
      </button>

      {showAmBoard && visibleProjects.length > 0 && <div className="h-px bg-white/5 my-1" />}

      {visibleProjects.map(p => (
        <div
          key={p.id}
          className={`group flex items-center transition-colors ${selectedId === p.id ? 'bg-pink-500/10' : 'hover:bg-zinc-700/60'}`}
        >
          <button
            onClick={() => { onSelect(p.id); setOpen(false); }}
            className={`flex-1 text-left px-3 py-2 text-sm flex items-center gap-2 min-w-0 ${selectedId === p.id ? 'text-pink-300' : 'text-zinc-200'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" style={{ opacity: selectedId === p.id ? 1 : 0 }} />
            <span className="truncate flex-1">{p.name}</span>
          </button>
          {onOpenProjectSettings && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenProjectSettings(p.id); setOpen(false); }}
              className="shrink-0 px-2 py-2 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Project settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          )}
        </div>
      ))}

      <div className="h-px bg-white/5 my-1" />

      <button
        onClick={() => { setOpen(false); setShowCreate(true); }}
        className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60 transition-colors flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {t('createNewProject')}
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 hover:border-white/20 text-zinc-300 transition-colors"
        >
          {/* Grid icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span className="max-w-[min(120px,30vw)] truncate">{selectedId === '__all__' ? 'All projects' : (selected?.name ?? 'HelloAm!')}</span>
          <svg className={`h-3 w-3 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {dropdown}
      </div>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={(p) => {
            onProjectCreated(p);
            setShowCreate(false);
          }}
        />
      )}
    </>
  );
}
