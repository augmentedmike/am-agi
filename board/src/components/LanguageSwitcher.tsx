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
    <div className="flex items-center gap-1">
      {LOCALES.map(({ value, label }, idx) => (
        <span key={value} className="flex items-center gap-1">
          {idx > 0 && <span className="text-zinc-600 text-xs select-none">·</span>}
          <button
            type="button"
            onClick={() => setLocale(value)}
            className={`text-xs px-1 py-0.5 rounded transition-colors ${
              locale === value
                ? 'text-zinc-100 font-bold underline underline-offset-2'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  );
}
