import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../../i18n/en';

const srcPath = join(import.meta.dir, '../ProjectSelector.tsx');
const src = readFileSync(srcPath, 'utf8');

describe('Template picker — source structure', () => {
  it('defines TEMPLATE_OPTIONS with 6 entries', () => {
    const matches = src.match(/\{ id: '[a-z-]+'/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(6);
  });

  it('includes all 6 required template IDs', () => {
    for (const id of ['blank', 'bun-lib', 'next-app', 'sales-outbound', 'customer-support', 'content-marketing']) {
      expect(src).toContain(`'${id}'`);
    }
  });

  it('renders template buttons grouped by category', () => {
    // Either the old TEMPLATE_CATEGORIES constant or the new TEMPLATE_GALLERY_GROUPS constant
    const hasGrouping = src.includes('TEMPLATE_CATEGORIES') || src.includes('TEMPLATE_GALLERY_GROUPS');
    expect(hasGrouping).toBe(true);
    expect(src).toContain('TEMPLATE_OPTIONS.filter');
  });

  it('applies pink ring to selected template', () => {
    expect(src).toContain('ring-pink-500');
    expect(src).toContain('border-pink-500');
  });

  it('sets templateType default to blank', () => {
    expect(src).toContain("useState<string>('blank')");
  });

  it('includes templateType in POST body', () => {
    expect(src).toContain('templateType');
    // templateType should appear in the body object
    const bodyLine = src.match(/const body[^=]*=.*templateType/);
    expect(bodyLine).not.toBeNull();
  });
});

describe('Template picker — i18n keys', () => {
  it('has templatePickerLabel', () => {
    expect(typeof en.templatePickerLabel).toBe('string');
    expect(en.templatePickerLabel.length).toBeGreaterThan(0);
  });

  const templateKeys = [
    'templateBlankName', 'templateBlankDesc',
    'templateBunLibName', 'templateBunLibDesc',
    'templateNextAppName', 'templateNextAppDesc',
    'templateSalesName', 'templateSalesDesc',
    'templateSupportName', 'templateSupportDesc',
    'templateContentName', 'templateContentDesc',
  ] as const;

  for (const key of templateKeys) {
    it(`has non-empty en.${key}`, () => {
      expect(typeof en[key]).toBe('string');
      expect((en[key] as string).length).toBeGreaterThan(0);
    });
  }
});

describe('Template picker — POST body includes templateType', () => {
  it('body object construction contains templateType field', () => {
    // The body object passed to fetch should contain templateType
    expect(src).toContain('templateType');
    // Verify it's spread into body, not just defined
    const bodyObjMatch = src.match(/const body[^{]*\{[^}]*templateType/);
    expect(bodyObjMatch).not.toBeNull();
  });
});
