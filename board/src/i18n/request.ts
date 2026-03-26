import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const SUPPORTED_LOCALES = ['en', 'es', 'zh'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

function isSupportedLocale(l: string): l is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(l);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('am:locale')?.value ?? 'en';
  const locale: SupportedLocale = isSupportedLocale(raw) ? raw : 'en';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
