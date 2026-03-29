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

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const complete = localStorage.getItem(COMPLETE_KEY);
      if (!complete || complete !== 'true') {
        setIsOnboardingComplete(false);
      }
      const roles = localStorage.getItem(ROLES_KEY);
      if (roles) setSelectedRoles(JSON.parse(roles));
    } catch {}
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
