'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Locale, Translations, getTranslations } from '../i18n';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof Translations) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => String(key),
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        const loc = data.locale;
        if (loc && ['en', 'es', 'zh'].includes(loc)) {
          setLocaleState(loc as Locale);
        }
      })
      .catch(() => {});
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    // Persist to cookie (read by next-intl i18n/request.ts on next navigation)
    document.cookie = `am:locale=${newLocale};path=/;max-age=31536000`;
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: newLocale }),
    }).catch(() => {});
  };

  const t = (key: keyof Translations): string => getTranslations(locale)[key];

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
