import { describe, it, expect } from 'bun:test';
import { TEMPLATE_TYPES, getAdapter } from '@am/agent/src/templates/index';

describe('GET /api/templates — shape (criterion 9)', () => {
  it('each registered adapter has type, displayName, description', () => {
    const result = TEMPLATE_TYPES.map(type => {
      const adapter = getAdapter(type);
      return {
        type: adapter.type,
        displayName: adapter.displayName,
        description: adapter.description,
      };
    });

    expect(result.length).toBeGreaterThanOrEqual(3);

    for (const entry of result) {
      expect(typeof entry.type).toBe('string');
      expect(entry.type.length).toBeGreaterThan(0);
      expect(typeof entry.displayName).toBe('string');
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(typeof entry.description).toBe('string');
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('includes blank, bun-lib, next-app types', () => {
    const types = TEMPLATE_TYPES.map(t => getAdapter(t).type);
    expect(types).toContain('blank');
    expect(types).toContain('bun-lib');
    expect(types).toContain('next-app');
  });
});

describe('TemplateSpec — each adapter spec (criterion 10)', () => {
  it('each adapter spec has non-empty pipeline.columns', () => {
    for (const type of TEMPLATE_TYPES) {
      const adapter = getAdapter(type);
      expect(adapter.spec.pipeline.columns.length).toBeGreaterThan(0);
      for (const col of adapter.spec.pipeline.columns) {
        expect(typeof col.id).toBe('string');
        expect(typeof col.label).toBe('string');
      }
    }
  });

  it('each adapter spec has non-empty pipeline.transitions', () => {
    for (const type of TEMPLATE_TYPES) {
      const adapter = getAdapter(type);
      expect(adapter.spec.pipeline.transitions.length).toBeGreaterThan(0);
      for (const tr of adapter.spec.pipeline.transitions) {
        expect(typeof tr.from).toBe('string');
        expect(typeof tr.to).toBe('string');
        expect(Array.isArray(tr.gates)).toBe(true);
      }
    }
  });

  it('blank adapter spec matches TemplateSpec interface', () => {
    const adapter = getAdapter('blank');
    const spec = adapter.spec;
    expect(spec.type).toBe('blank');
    expect(typeof spec.displayName).toBe('string');
    expect(typeof spec.description).toBe('string');
    expect(Array.isArray(spec.cardTypes)).toBe(true);
    expect(Array.isArray(spec.fields)).toBe(true);
  });

  it('bun-lib adapter spec matches TemplateSpec interface', () => {
    const adapter = getAdapter('bun-lib');
    const spec = adapter.spec;
    expect(spec.type).toBe('bun-lib');
    expect(typeof spec.displayName).toBe('string');
    expect(typeof spec.description).toBe('string');
    expect(Array.isArray(spec.cardTypes)).toBe(true);
    expect(Array.isArray(spec.fields)).toBe(true);
  });

  it('next-app adapter spec matches TemplateSpec interface', () => {
    const adapter = getAdapter('next-app');
    const spec = adapter.spec;
    expect(spec.type).toBe('next-app');
    expect(typeof spec.displayName).toBe('string');
    expect(typeof spec.description).toBe('string');
    expect(Array.isArray(spec.cardTypes)).toBe(true);
    expect(Array.isArray(spec.fields)).toBe(true);
  });
});
