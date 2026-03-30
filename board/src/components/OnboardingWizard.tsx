'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useChat } from '@/contexts/ChatContext';

const ROLES = [
  'Software Engineering',
  'Product Management',
  'Design',
  'Marketing',
  'Operations',
  'Data / Analytics',
  'Sales / BD',
  'Founder / Leadership',
  'Research',
  'Other',
];

const ROLES_KEY = 'am_onboarding_roles';

// ── Step 1 — Welcome ──────────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-8 w-full max-w-md mx-auto">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold text-white tracking-tight">Welcome to AM</h1>
        <p className="text-white/40 text-sm font-light">Your autonomous digital worker</p>
      </div>

      <p className="text-white/60 text-base leading-relaxed font-light">
        AM is a persistent digital worker with memory, context, and judgment. Give her work — she handles the rest.
      </p>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
        style={{ background: 'rgba(255,255,255,0.92)', color: '#000' }}
      >
        Get started
      </button>
    </div>
  );
}

// ── Step 2 — Roles ────────────────────────────────────────────────────────────

function Step2({ onNext }: { onNext: (roles: string[]) => void }) {
  const { selectedRoles, setRoles } = useOnboarding();
  const [local, setLocal] = useState<string[]>(selectedRoles);

  const toggle = (role: string) => {
    setLocal(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleNext = () => {
    try { localStorage.setItem(ROLES_KEY, JSON.stringify(local)); } catch {}
    setRoles(local);
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingRoles: local }),
    }).catch(() => {});
    onNext(local);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white tracking-tight">What do you work on?</h2>
        <p className="text-white/50 text-sm mt-1.5 font-light">AM will tailor itself to your context.</p>
      </div>

      <div className="w-full grid grid-cols-2 gap-2">
        {ROLES.map(role => (
          <button
            key={role}
            onClick={() => toggle(role)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all duration-150 text-sm"
            style={local.includes(role) ? {
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
            } : {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
              style={local.includes(role) ? {
                background: 'rgba(255,255,255,0.9)',
              } : {
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {local.includes(role) && (
                <svg className="w-2 h-2" style={{ color: '#000' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="font-medium text-xs leading-tight">{role}</span>
          </button>
        ))}
      </div>

      <button
        onClick={handleNext}
        disabled={local.length === 0}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
        style={local.length === 0 ? {
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.3)',
          cursor: 'not-allowed',
        } : {
          background: 'rgba(255,255,255,0.92)',
          color: '#000',
        }}
      >
        Continue
      </button>
    </div>
  );
}

// ── Step 3 — First Project ────────────────────────────────────────────────────

interface TemplateOption { type: string; displayName: string; description: string; }

function Step3({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('');
  const [repoDir, setRepoDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [hasProjects, setHasProjects] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then((d: TemplateOption[]) => setTemplates(d)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((p: unknown[]) => { if (p.length > 0) { setHasProjects(true); setTimeout(onNext, 400); } })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [onNext]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !repoDir.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), repoDir: repoDir.trim(), templateType: selectedTemplate }),
      });
      if (res.ok) { onNext(); }
      else { const d = await res.json(); setError(d.error ?? 'Failed to create project'); }
    } catch { setError('Network error — please try again'); }
    finally { setLoading(false); }
  };

  if (checking || hasProjects) {
    return (
      <div className="flex items-center justify-center w-full h-32">
        <p className="text-white/40 text-sm">{hasProjects ? 'Already have projects — skipping…' : 'Checking…'}</p>
      </div>
    );
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    outline: 'none',
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white tracking-tight">Create your first project</h2>
        <p className="text-white/50 text-sm mt-1.5 font-light">Link a local repo so AM can work on it.</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Project name"
          required
          className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/25 focus:ring-0"
          style={inputStyle}
        />
        <input
          type="text"
          value={repoDir}
          onChange={e => setRepoDir(e.target.value)}
          placeholder="/Users/you/projects/my-app"
          required
          className="w-full rounded-xl px-4 py-3 text-sm placeholder-white/25 focus:ring-0"
          style={inputStyle}
        />

        {templates.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {templates.map(t => (
              <button
                key={t.type}
                type="button"
                onClick={() => setSelectedTemplate(t.type)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl transition-all duration-150"
                style={selectedTemplate === t.type ? {
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                } : {
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <span className="block text-xs font-semibold text-white/90">{t.displayName}</span>
                <span className="block text-xs text-white/40 mt-0.5">{t.description}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-red-400/80 text-xs px-1">{error}</p>}

        <button
          type="submit"
          disabled={!name.trim() || !repoDir.trim() || loading}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 mt-1"
          style={!name.trim() || !repoDir.trim() || loading ? {
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.3)',
            cursor: 'not-allowed',
          } : {
            background: 'rgba(255,255,255,0.92)',
            color: '#000',
          }}
        >
          {loading ? 'Creating…' : 'Create project'}
        </button>
      </form>

      <button
        type="button"
        onClick={onNext}
        className="text-white/30 hover:text-white/60 text-xs transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}

// ── Step 4 — Done ─────────────────────────────────────────────────────────────

function Step4({ onComplete }: { onComplete: () => void }) {
  const { openChat } = useChat();

  const handleStart = () => {
    onComplete();
    openChat('Hi AM, I just installed you!');
  };

  return (
    <div className="flex flex-col items-center text-center gap-8 w-full max-w-md mx-auto">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-3xl font-semibold text-white tracking-tight">You&apos;re all set</h2>
        <p className="text-white/40 text-sm font-light">AM is ready to work</p>
      </div>

      <p className="text-white/60 text-base leading-relaxed font-light">
        Say hello — AM is waiting to hear what you&apos;d like to work on.
      </p>

      <button
        onClick={handleStart}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
        style={{ background: 'rgba(255,255,255,0.92)', color: '#000' }}
      >
        Say hello to AM →
      </button>
    </div>
  );
}

// ── Wizard Shell ──────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const { isOnboardingComplete, currentStep, nextStep, setRoles, completeOnboarding } = useOnboarding();

  if (isOnboardingComplete) return null;

  const totalSteps = 4;

  const handleStep2Next = (roles: string[]) => { setRoles(roles); nextStep(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(24px) saturate(180%)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(40px)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-6 pb-0 px-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i + 1 === currentStep ? 20 : 6,
                height: 6,
                background: i + 1 <= currentStep ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-10 min-h-[380px] flex items-center justify-center">
          {currentStep === 1 && <Step1 onNext={nextStep} />}
          {currentStep === 2 && <Step2 onNext={handleStep2Next} />}
          {currentStep === 3 && <Step3 onNext={nextStep} />}
          {currentStep === 4 && <Step4 onComplete={completeOnboarding} />}
        </div>

        {/* Step label */}
        <div className="pb-6 flex items-center justify-center">
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
            {currentStep} of {totalSteps}
          </span>
        </div>
      </div>
    </div>
  );
}
