import { en, TranslationKeys } from './en';
import { es } from './es';
import { zh } from './zh';
import { de } from './de';
import { fr } from './fr';
import { ko } from './ko';

export type Locale = 'en' | 'es' | 'zh' | 'de' | 'fr' | 'ko';

export type Translations = typeof en;

export type { TranslationKeys };

const translations: Record<Locale, Translations> = {
  en,
  es: es as unknown as Translations,
  zh: zh as unknown as Translations,
  de: de as unknown as Translations,
  fr: fr as unknown as Translations,
  ko: ko as unknown as Translations,
};

export function getTranslations(locale: Locale): Translations {
  return translations[locale] ?? translations.en;
}
