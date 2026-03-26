'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useLocale } from '@/contexts/LocaleContext';
import enMessages from '../../messages/en.json';
import esMessages from '../../messages/es.json';
import zhMessages from '../../messages/zh.json';

const allMessages = {
  en: enMessages,
  es: esMessages,
  zh: zhMessages,
} as const;

export function IntlWrapper({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const messages = allMessages[locale] ?? allMessages.en;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
