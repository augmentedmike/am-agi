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

// Step 1 — Welcome / Tour
function Step1({ onNext }: { onNext: () => void }) {
  const columnHeaders = ['Backlog', 'In Progress', 'In Review', 'Shipped'];
  return (
    <div className="flex flex-col items-center text-center gap-6 px-4 w-full max-w-xl mx-auto">
      <div className="text-5xl">👋</div>
      <h1 className="text-3xl font-bold text-white">Welcome to AM</h1>
      <p className="text-text-secondary text-base leading-relaxed">
        AM is your autonomous digital worker — a Kanban-driven agent that plans,
        implements, and ships work for you. Cards flow left to right as AM
        completes each stage.
      </p>

      {/* Column spotlight annotation */}
      <div className="w-full mt-2">
        <p className="text-sm text-text-secondary mb-3 font-medium uppercase tracking-wide">Your workflow</p>
        <div className="grid grid-cols-4 gap-2">
          {columnHeaders.map((col, i) => (
            <div
              key={col}
              className="rounded-lg border-2 border-blue-400 bg-blue-400/10 px-2 py-3 flex flex-col items-center gap-1 relative"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs font-semibold text-white text-center leading-tight">{col}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 px-4">
          {[0,1,2].map(i => (
            <div key={i} className="flex-1 h-px bg-blue-400/40 relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t border-r border-blue-400/60 rotate-45" />
            </div>
          ))}
        </div>
        <p className="text-xs text-blue-400/80 mt-3 text-center">↑ These column headers are highlighted on your board above</p>
      </div>

      <button
        onClick={onNext}
        className="mt-4 px-8 py-3 rounded-lg bg-accent-primary text-white font-semibold hover:bg-accent-primary/90 transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

// Step 2 — Roles
function Step2({ onNext }: { onNext: (roles: string[]) => void }) {
  const { selectedRoles, setRoles } = useOnboarding();
  const [local, setLocal] = useState<string[]>(selectedRoles);

  const toggle = (role: string) => {
    setLocal(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleNext = () => {
    // Save to localStorage
    try { localStorage.setItem(ROLES_KEY, JSON.stringify(local)); } catch {}
    setRoles(local);
    // Persist to server
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingRoles: local }),
    }).catch(() => {});
    onNext(local);
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4 w-full max-w-xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">What do you work on?</h2>
        <p className="text-text-secondary text-sm mt-2">
          Select all that apply — AM will tailor suggestions to your context.
        </p>
      </div>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ROLES.map(role => (
          <button
            key={role}
            onClick={() => toggle(role)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
              local.includes(role)
                ? 'border-accent-primary bg-accent-primary/10 text-white'
                : 'border-border bg-surface text-text-secondary hover:border-accent-primary/50'
            }`}
          >
            <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
              local.includes(role) ? 'border-accent-primary bg-accent-primary' : 'border-border'
            }`}>
              {local.includes(role) && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm font-medium">{role}</span>
          </button>
        ))}
      </div>

      <button
        onClick={handleNext}
        disabled={local.length === 0}
        className="mt-2 px-8 py-3 rounded-lg bg-accent-primary text-white font-semibold hover:bg-accent-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  );
}

interface TemplateOption {
  type: string;
  displayName: string;
  description: string;
}

// Step 3 — First Project
function Step3({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('');
  const [repoDir, setRepoDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [hasProjects, setHasProjects] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');

  // Load templates
  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then((data: TemplateOption[]) => setTemplates(data))
      .catch(() => {});
  }, []);

  // Check if user already has projects
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((projects: unknown[]) => {
        if (projects.length > 0) {
          setHasProjects(true);
          // Auto-skip
          setTimeout(onNext, 500);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [onNext]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !repoDir.trim() || !selectedTemplate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), repoDir: repoDir.trim(), templateType: selectedTemplate }),
      });
      if (res.ok) {
        onNext();
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to create project');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 w-full max-w-xl mx-auto">
        <div className="text-text-secondary text-sm">Checking your projects…</div>
      </div>
    );
  }

  if (hasProjects) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 w-full max-w-xl mx-auto">
        <div className="text-text-secondary text-sm">You already have projects — skipping…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 w-full max-w-xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Create your first project</h2>
        <p className="text-text-secondary text-sm mt-2">
          Link a local repo so AM can work on it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Project name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My awesome app"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-primary/60 placeholder-text-secondary/50"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Repository path
          </label>
          <input
            type="text"
            value={repoDir}
            onChange={e => setRepoDir(e.target.value)}
            placeholder="/Users/you/projects/my-app"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-primary/60 placeholder-text-secondary/50"
            required
          />
        </div>

        {templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Template
            </label>
            <div className="flex flex-col gap-2">
              {templates.map(t => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setSelectedTemplate(t.type)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    selectedTemplate === t.type
                      ? 'border-accent-primary/60 bg-accent-primary/10'
                      : 'border-border bg-surface hover:border-border/80'
                  }`}
                >
                  <span className="block text-sm font-medium text-white">{t.displayName}</span>
                  <span className="block text-xs text-text-secondary mt-0.5">{t.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={!name.trim() || !repoDir.trim() || !selectedTemplate || loading}
          className="w-full px-8 py-3 rounded-lg bg-accent-primary text-white font-semibold hover:bg-accent-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating…' : 'Create project →'}
        </button>
      </form>

      <button
        type="button"
        onClick={onNext}
        className="text-text-secondary hover:text-white text-sm transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}

// Step 4 — Done, open real chat
function Step4({ onComplete }: { onComplete: () => void }) {
  const { openChat } = useChat();

  const handleStart = () => {
    onComplete();
    openChat('Hi AM, I just installed you!');
  };

  return (
    <div className="flex flex-col items-center text-center gap-6 px-4 w-full max-w-xl mx-auto">
      <div className="text-6xl">🎉</div>
      <h2 className="text-3xl font-bold text-white">You&apos;re all set!</h2>
      <p className="text-text-secondary text-base leading-relaxed">
        AM is ready. Say hello — she&apos;s waiting to hear from you.
      </p>
      <button
        onClick={handleStart}
        className="mt-4 px-10 py-3 rounded-lg bg-accent-primary text-white font-bold text-lg hover:bg-accent-primary/90 transition-colors shadow-lg shadow-accent-primary/20"
      >
        Say hello to AM →
      </button>
    </div>
  );
}

// Main Wizard Shell
export function OnboardingWizard() {
  const { isOnboardingComplete, currentStep, nextStep, setRoles, completeOnboarding } = useOnboarding();

  if (isOnboardingComplete) return null;

  const totalSteps = 4;

  const handleStep2Next = (roles: string[]) => {
    setRoles(roles);
    nextStep();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding wizard"
    >
      <div className="relative w-full max-w-2xl mx-4 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-start px-6 pt-6 pb-0">
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i + 1 === currentStep
                    ? 'w-6 bg-accent-primary'
                    : i + 1 < currentStep
                    ? 'w-3 bg-accent-primary/60'
                    : 'w-3 bg-border'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8 min-h-[400px] flex items-center justify-center">
          {currentStep === 1 && <Step1 onNext={nextStep} />}
          {currentStep === 2 && <Step2 onNext={handleStep2Next} />}
          {currentStep === 3 && <Step3 onNext={nextStep} />}
          {currentStep === 4 && <Step4 onComplete={completeOnboarding} />}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-center">
          <span className="text-text-secondary text-xs">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
      </div>
    </div>
  );
}
