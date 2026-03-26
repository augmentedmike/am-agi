import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

import { en } from '../en';
import { es } from '../es';
import { zh } from '../zh';
import { getTranslations } from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const messagesDir = join(import.meta.dir, '../../../messages');

function readJson(filename: string): Record<string, Record<string, string>> {
  return JSON.parse(readFileSync(join(messagesDir, filename), 'utf-8'));
}

const enJson = readJson('en.json');
const esJson = readJson('es.json');
const zhJson = readJson('zh.json');

// Values where identical content across locales is intentional:
// - pure format strings like "{count} active"
// - proper nouns / brand names: "AM Board", "AM", "GitHub"
// - technical placeholders: paths, email examples, token examples
// - loanwords that are the same in Spanish/Chinese: "Demo", "Chat", "total", "error"
const ALLOWED_IDENTICAL_PATTERNS = [
  /^\{[^}]+\}/, // pure placeholder like {count}
  /^\{[^}]+\}\s/, // starts with placeholder
  /^AM Board$/, // brand name
  /^AM$/, // abbreviation
  /^GitHub$/, // brand name
  /^[+✓↩▼▲·]/, // symbol-only tokens
  /^~\//, // filesystem path placeholder
  /^ghp_/, // GitHub token placeholder
  /@.*\.com$/, // email placeholder
];

// Known values that are legitimately identical across all locales
// (loanwords, universal abbreviations, technical terms)
const ALLOWED_IDENTICAL_VALUES = new Set([
  'Demo',
  'Chat',
  'total',
  'error',
  'GitHub',
]);

function isExpectedIdentical(value: string): boolean {
  const trimmed = value.trim();
  return (
    ALLOWED_IDENTICAL_VALUES.has(trimmed) ||
    ALLOWED_IDENTICAL_PATTERNS.some((p) => p.test(trimmed))
  );
}

// ---------------------------------------------------------------------------
// JSON messages tests (criteria 1–8)
// ---------------------------------------------------------------------------

describe('JSON messages — es.json', () => {
  const enNamespaces = Object.keys(enJson);

  test('contains every namespace present in en.json (criterion 1)', () => {
    for (const ns of enNamespaces) {
      expect(Object.keys(esJson)).toContain(ns);
    }
  });

  test('contains no extra namespaces absent from en.json (criterion 5)', () => {
    for (const ns of Object.keys(esJson)) {
      expect(enNamespaces).toContain(ns);
    }
  });

  for (const ns of enNamespaces) {
    const enKeys = Object.keys(enJson[ns] ?? {});

    test(`[${ns}] contains every key from en.json with a non-empty value (criteria 3, 4)`, () => {
      const esNs = esJson[ns] ?? {};
      for (const key of enKeys) {
        expect(esNs).toHaveProperty(key);
        expect((esNs as Record<string, string>)[key]).toBeTruthy();
      }
    });

    test(`[${ns}] contains no extra keys absent from en.json (criterion 5)`, () => {
      const esNs = esJson[ns] ?? {};
      for (const key of Object.keys(esNs)) {
        expect(enKeys).toContain(key);
      }
    });

    test(`[${ns}] values differ from en.json where translation is expected (criterion 7)`, () => {
      const esNs = esJson[ns] ?? {};
      for (const key of enKeys) {
        const enVal = (enJson[ns] as Record<string, string>)[key];
        const esVal = (esNs as Record<string, string>)[key];
        if (isExpectedIdentical(enVal)) continue;
        expect(esVal).not.toBe(enVal);
      }
    });
  }
});

describe('JSON messages — zh.json', () => {
  const enNamespaces = Object.keys(enJson);

  test('contains every namespace present in en.json (criterion 2)', () => {
    for (const ns of enNamespaces) {
      expect(Object.keys(zhJson)).toContain(ns);
    }
  });

  test('contains no extra namespaces absent from en.json (criterion 6)', () => {
    for (const ns of Object.keys(zhJson)) {
      expect(enNamespaces).toContain(ns);
    }
  });

  for (const ns of enNamespaces) {
    const enKeys = Object.keys(enJson[ns] ?? {});

    test(`[${ns}] contains every key from en.json with a non-empty value (criteria 3, 4)`, () => {
      const zhNs = zhJson[ns] ?? {};
      for (const key of enKeys) {
        expect(zhNs).toHaveProperty(key);
        expect((zhNs as Record<string, string>)[key]).toBeTruthy();
      }
    });

    test(`[${ns}] contains no extra keys absent from en.json (criterion 6)`, () => {
      const zhNs = zhJson[ns] ?? {};
      for (const key of Object.keys(zhNs)) {
        expect(enKeys).toContain(key);
      }
    });

    test(`[${ns}] values differ from en.json where translation is expected (criterion 8)`, () => {
      const zhNs = zhJson[ns] ?? {};
      for (const key of enKeys) {
        const enVal = (enJson[ns] as Record<string, string>)[key];
        const zhVal = (zhNs as Record<string, string>)[key];
        if (isExpectedIdentical(enVal)) continue;
        expect(zhVal).not.toBe(enVal);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// TypeScript translations tests (criteria 9–15)
// ---------------------------------------------------------------------------

describe('TypeScript translations', () => {
  const enKeys = Object.keys(en) as (keyof typeof en)[];

  test('en.ts exports a non-empty object (criterion 9)', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  test('es has the same set of keys as en (criterion 10)', () => {
    const esKeys = Object.keys(es).sort();
    expect(esKeys).toEqual([...enKeys].sort());
  });

  test('zh has the same set of keys as en (criterion 10)', () => {
    const zhKeys = Object.keys(zh).sort();
    expect(zhKeys).toEqual([...enKeys].sort());
  });

  test('getTranslations("en") returns a non-empty object with all expected keys (criterion 11)', () => {
    const t = getTranslations('en');
    expect(Object.keys(t).length).toBeGreaterThan(0);
    for (const key of enKeys) {
      expect(t).toHaveProperty(key);
    }
  });

  test('getTranslations("es") returns the Spanish object, not the English fallback (criterion 12)', () => {
    const t = getTranslations('es');
    // Spot-check a key that is clearly different in Spanish
    expect((t as unknown as typeof es).backlog).toBe(es.backlog);
    expect((t as unknown as typeof es).backlog).not.toBe(en.backlog);
  });

  test('getTranslations("zh") returns the Chinese object, not the English fallback (criterion 13)', () => {
    const t = getTranslations('zh');
    expect((t as unknown as typeof zh).backlog).toBe(zh.backlog);
    expect((t as unknown as typeof zh).backlog).not.toBe(en.backlog);
  });

  test('getTranslations with unknown locale falls back to en (criterion 14)', () => {
    // Cast to bypass type-check since 'fr' is not a valid Locale
    const t = getTranslations('fr' as Parameters<typeof getTranslations>[0]);
    expect(t).toEqual(en);
  });

  test('es has no empty-string values (criterion 15)', () => {
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(es[key]).not.toBe('');
    }
  });

  test('zh has no empty-string values (criterion 15)', () => {
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(zh[key]).not.toBe('');
    }
  });
});
