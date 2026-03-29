'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

const COMPLETE_KEY = 'am_onboarding_complete';
const ROLES_KEY = 'am_onboarding_roles';

type OnboardingContextValue = {
  isOnboardingComplete: boolean;
  currentStep: number;
  selectedRoles: string[];
  spotlightColumns: boolean;
  nextStep: () => void;
  skipOnboarding: () => void;
  setRoles: (roles: string[]) => void;
  completeOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue>({
  isOnboardingComplete: true,
  currentStep: 1,
  selectedRoles: [],
  spotlightColumns: false,
  nextStep: () => {},
  skipOnboarding: () => {},
  setRoles: () => {},
  completeOnboarding: () => {},
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

/**
 * Returns true if the user already has projects or cards.
 * Exported for unit testing.
 */
export async function checkUserHasData(
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const [projectsRes, cardsRes] = await Promise.all([
    fetcher('/api/projects'),
    fetcher('/api/cards'),
  ]);
  const [projects, cards] = await Promise.all([
    projectsRes.ok ? projectsRes.json() : [],
    cardsRes.ok ? cardsRes.json() : [],
  ]);
  return (Array.isArray(projects) && projects.length > 0)
    || (Array.isArray(cards) && cards.length > 0);
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const run = async () => {
      try {
        const roles = localStorage.getItem(ROLES_KEY);
        if (roles) setSelectedRoles(JSON.parse(roles));

        const complete = localStorage.getItem(COMPLETE_KEY);
        if (complete === 'true') {
          // Already marked complete — no API calls needed, wizard stays hidden
          return;
        }

        // No localStorage flag — check whether the user already has data
        const hasData = await checkUserHasData();

        if (hasData) {
          // Existing user — suppress wizard and remember for next load
          try { localStorage.setItem(COMPLETE_KEY, 'true'); } catch {}
          // isOnboardingComplete stays true (default) — no state change needed
        } else {
          // Genuinely new user — show wizard
          setIsOnboardingComplete(false);
        }
      } catch {
        // On any error fall back to showing the wizard
        setIsOnboardingComplete(false);
      }
    };
    run();
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(s => s + 1);
  }, []);

  const skipOnboarding = useCallback(() => {
    try { localStorage.setItem(COMPLETE_KEY, 'true'); } catch {}
    setIsOnboardingComplete(true);
  }, []);

  const setRoles = useCallback((roles: string[]) => {
    setSelectedRoles(roles);
  }, []);

  const completeOnboarding = useCallback(() => {
    try { localStorage.setItem(COMPLETE_KEY, 'true'); } catch {}
    setIsOnboardingComplete(true);
  }, []);

  // Don't render wizard on server
  if (!mounted) return <>{children}</>;

  return (
    <OnboardingContext.Provider value={{
      isOnboardingComplete,
      currentStep,
      selectedRoles,
      spotlightColumns: !isOnboardingComplete && currentStep === 1,
      nextStep,
      skipOnboarding,
      setRoles,
      completeOnboarding,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}
