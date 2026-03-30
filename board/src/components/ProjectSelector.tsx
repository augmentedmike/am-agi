'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { pinyin } from 'pinyin-pro';
import type { Project } from './BoardClient';
import { useLocale } from '@/contexts/LocaleContext';
import { AM_BOARD_PROJECT_ID } from '@/lib/constants';

const LS_KEY = 'am_show_test_projects';

const WORKSPACE_BASE = '~/am/workspaces';

// SVG icon for each template — no emojis
const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'blank': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  'sales-outbound': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  'content-marketing': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  'customer-support': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  ),
  'customer-success': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  'hiring': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  'partnerships': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
  'pr-outreach': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
    </svg>
  ),
  'knowledge-base': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  'community': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  'ops': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
  'next-app': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  ),
  'bun-lib': (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  ),
};

const TEMPLATE_OPTIONS = [
  { id: 'blank',             labelKey: 'templateBlankName',   descKey: 'templateBlankDesc',   category: 'blank' },
  { id: 'sales-outbound',    labelKey: 'templateSalesName',           descKey: 'templateSalesDesc',           category: 'Workflows' },
  { id: 'content-marketing', labelKey: 'templateContentName',         descKey: 'templateContentDesc',         category: 'Workflows' },
  { id: 'customer-support',  labelKey: 'templateSupportName',         descKey: 'templateSupportDesc',         category: 'Workflows' },
  { id: 'customer-success',  labelKey: 'templateCustomerSuccessName', descKey: 'templateCustomerSuccessDesc', category: 'Workflows' },
  { id: 'hiring',            labelKey: 'templateHiringName',          descKey: 'templateHiringDesc',          category: 'Workflows' },
  { id: 'partnerships',      labelKey: 'templatePartnershipsName',    descKey: 'templatePartnershipsDesc',    category: 'Workflows' },
  { id: 'pr-outreach',       labelKey: 'templatePrOutreachName',      descKey: 'templatePrOutreachDesc',      category: 'Workflows' },
  { id: 'knowledge-base',    labelKey: 'templateKnowledgeBaseName',   descKey: 'templateKnowledgeBaseDesc',   category: 'Workflows' },
  { id: 'community',         labelKey: 'templateCommunityName',       descKey: 'templateCommunityDesc',       category: 'Workflows' },
  { id: 'ops',               labelKey: 'templateOpsName',             descKey: 'templateOpsDesc',             category: 'Workflows' },
  { id: 'next-app',          labelKey: 'templateNextAppName',         descKey: 'templateNextAppDesc',         category: 'Build' },
  { id: 'bun-lib',           labelKey: 'templateBunLibName',          descKey: 'templateBunLibDesc',          category: 'Build' },
] as const;

// Simple category list — matches the onboarding step
const CREATE_CATEGORIES = [
  { label: 'Software', templateType: 'software' },
  { label: 'Sales',    templateType: 'sales-outbound' },
  { label: 'Support',  templateType: 'customer-support' },
  { label: 'Content',  templateType: 'content-marketing' },
] as const;

const SOFTWARE_TEMPLATE_TYPES = new Set(['software', 'next-app', 'bun-lib']);
const CONTENT_TEMPLATE_TYPES = new Set(['content-marketing', 'knowledge-base', 'community', 'pr-outreach']);

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
      <div className={`${selected ? 'text-pink-300' : 'text-zinc-400'} transition-colors`}>
        {TEMPLATE_ICONS[tpl.id]}
      </div>
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [versioned, setVersioned] = useState(false);
  const [githubRepo, setGithubRepo] = useState('');
  const [vercelUrl, setVercelUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Email config (support template)
  const [emailMode, setEmailMode] = useState<'gmail' | 'manual'>('gmail');
  const [emailAddr, setEmailAddr] = useState('');
  const [emailPass, setEmailPass] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');

  // Content/social fields
  const [socialWebsite, setSocialWebsite] = useState('');
  const [socialYoutube, setSocialYoutube] = useState('');
  const [socialTwitter, setSocialTwitter] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialTiktok, setSocialTiktok] = useState('');
  const [socialLinkedin, setSocialLinkedin] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [contentCadence, setContentCadence] = useState('');

  const isSoftware = SOFTWARE_TEMPLATE_TYPES.has(templateType);
  const isSupport = templateType === 'customer-support';
  const isContent = CONTENT_TEMPLATE_TYPES.has(templateType);

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
      const project = await res.json();

      // Save content/social meta if any fields filled
      if (isContent && (socialWebsite || socialYoutube || socialTwitter || socialInstagram || socialTiktok || socialLinkedin || targetAudience || contentCadence)) {
        await fetch(`/api/projects/${project.id}/meta`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website: socialWebsite,
            youtube: socialYoutube,
            twitter: socialTwitter,
            instagram: socialInstagram,
            tiktok: socialTiktok,
            linkedin: socialLinkedin,
            targetAudience,
            cadence: contentCadence,
          }),
        });
      }

      onCreate(project);
    } catch {
      setError(t('networkErrorShort'));
    } finally {
      setSubmitting(false);
    }
  }

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

      {/* Step 1: Template picker — same style as onboarding */}
      {step === 1 && (
        <div className="flex-1 flex items-center justify-center bg-zinc-900/95 px-6 py-10">
          <div className="flex flex-col gap-6 w-full max-w-sm">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white tracking-tight">{t('stepSelectTemplate')}</h2>
              <p className="text-zinc-500 text-sm mt-1">Pick a template to get started.</p>
            </div>

            {/* Blank */}
            <button
              type="button"
              onClick={() => { setTemplateType('blank'); setSelectedCategory(null); }}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 text-left flex items-center gap-3"
              style={templateType === 'blank' && !selectedCategory ? {
                background: 'rgba(236,72,153,0.15)',
                border: '1px solid rgba(236,72,153,0.5)',
                color: 'rgb(249,168,212)',
              } : {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
              }}
            >
              <span className="shrink-0">{TEMPLATE_ICONS['blank']}</span>
              <span>Blank — start from scratch</span>
            </button>

            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              {CREATE_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => { setSelectedCategory(cat.label); setTemplateType(cat.templateType); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={selectedCategory === cat.label ? {
                    background: 'rgba(236,72,153,0.15)',
                    border: '1px solid rgba(236,72,153,0.5)',
                    color: 'rgb(249,168,212)',
                  } : {
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 text-sm font-medium bg-pink-500 hover:bg-pink-400 text-white rounded-xl transition-colors"
            >
              {t('continueButton')}
            </button>
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
                  <div className="text-zinc-400 shrink-0">{TEMPLATE_ICONS[sel.id]}</div>
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

              {isContent && (
                <div className="flex flex-col gap-3 pt-1 border-t border-white/5">
                  <p className="text-xs text-zinc-500">Add channels and context so the agent knows where content will be published.</p>
                  {[
                    { label: 'Website / Blog', placeholder: 'https://yourblog.com', value: socialWebsite, set: setSocialWebsite },
                    { label: 'YouTube', placeholder: 'https://youtube.com/@channel', value: socialYoutube, set: setSocialYoutube },
                    { label: 'X / Twitter', placeholder: '@handle', value: socialTwitter, set: setSocialTwitter },
                    { label: 'Instagram', placeholder: '@handle', value: socialInstagram, set: setSocialInstagram },
                    { label: 'TikTok', placeholder: '@handle', value: socialTiktok, set: setSocialTiktok },
                    { label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...', value: socialLinkedin, set: setSocialLinkedin },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500 w-28 shrink-0">{f.label}</span>
                      <input
                        type="text"
                        value={f.value}
                        onChange={e => f.set(e.target.value)}
                        placeholder={f.placeholder}
                        className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-pink-500"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-28 shrink-0">Target Audience</span>
                    <input
                      type="text"
                      value={targetAudience}
                      onChange={e => setTargetAudience(e.target.value)}
                      placeholder="e.g. Indie hackers, ages 25-40"
                      className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-28 shrink-0">Cadence</span>
                    <input
                      type="text"
                      value={contentCadence}
                      onChange={e => setContentCadence(e.target.value)}
                      placeholder="e.g. 2 videos/week, daily tweets"
                      className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                  </div>
                </div>
              )}

              {isSoftware && (
                <>
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
                      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{t('liveUrlLabel')}</label>
                      <input
                        type="url"
                        value={vercelUrl}
                        onChange={e => setVercelUrl(e.target.value)}
                        placeholder="https://yourapp.com"
                        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      />
                    </div>
                  </div>
                </>
              )}

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
