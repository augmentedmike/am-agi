'use client';

import { useLocale } from '@/contexts/LocaleContext';
import type { Locale } from '@/i18n';

const LOCALES: { value: Locale; label: string; name: string }[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'es', label: 'ES', name: 'Español' },
  { value: 'zh', label: '中文', name: 'Chinese' },
  { value: 'de', label: 'DE', name: 'Deutsch' },
  { value: 'fr', label: 'FR', name: 'Français' },
  { value: 'ko', label: '한국어', name: 'Korean' },
];

export function BoardFooter() {
  const { locale, setLocale } = useLocale();

  return (
    <footer className="flex items-center justify-between px-4 py-2 border-t border-white/5 bg-zinc-950/80 shrink-0">
      <a
        href="https://helloam.bot"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Powered by HelloAm!
      </a>
      <select
        value={locale}
        onChange={e => setLocale(e.target.value as Locale)}
        className="bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-400 focus:outline-none focus:ring-1 focus:ring-pink-500 cursor-pointer hover:border-white/20 transition-colors"
        aria-label="Language"
      >
        {LOCALES.map(({ value, label, name }) => (
          <option key={value} value={value}>{label} — {name}</option>
        ))}
      </select>
    </footer>
  );
}
