'use client';

import { useLocale } from '@/contexts/LocaleContext';
import type { Locale } from '@/i18n';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
  { value: 'zh', label: '中文' },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <select
      value={locale}
      onChange={e => setLocale(e.target.value as Locale)}
      className="text-sm bg-zinc-800 border border-white/10 text-zinc-300 rounded-lg px-2 py-1.5 cursor-pointer hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
    >
      {LOCALES.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
