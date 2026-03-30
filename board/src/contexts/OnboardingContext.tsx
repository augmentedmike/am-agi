'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

const COMPLETE_KEY = 'am_onboarding_complete';
const ROLES_KEY = 'am_onboarding_roles';

type OnboardingContextValue = {
  isOnboardingComplete: boolean;
  isCheckingOnboarding: boolean;
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
  isCheckingOnboarding: true,
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
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        const roles = localStorage.getItem(ROLES_KEY);
        if (roles) setSelectedRoles(JSON.parse(roles));

        // Always check the DB — localStorage can be stale after a reinstall
        const hasData = await checkUserHasData();

        if (hasData) {
          try { localStorage.setItem(COMPLETE_KEY, 'true'); } catch {}
          setIsOnboardingComplete(true);
        } else {
          // Empty DB — show wizard regardless of localStorage flag
          try { localStorage.removeItem(COMPLETE_KEY); } catch {}
          setIsOnboardingComplete(false);
        }
      } catch {
        // On any error fall back to showing the wizard
        setIsOnboardingComplete(false);
      } finally {
        setIsCheckingOnboarding(false);
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

  return (
    <OnboardingContext.Provider value={{
      isOnboardingComplete,
      isCheckingOnboarding,
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
