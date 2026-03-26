import { en, TranslationKeys } from './en';
import { es } from './es';
import { zh } from './zh';

export type Locale = 'en' | 'es' | 'zh';

export type Translations = typeof en;

export type { TranslationKeys };

const translations: Record<Locale, Translations> = {
  en,
  es: es as unknown as Translations,
  zh: zh as unknown as Translations,
};

export function getTranslations(locale: Locale): Translations {
  return translations[locale] ?? translations.en;
}
