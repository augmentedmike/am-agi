import { describe, it, expect } from 'bun:test';
import { isWebProject } from '../web-project';
import { AM_BOARD_PROJECT_ID } from '../constants';

describe('isWebProject', () => {
  it('returns true for a next-app project', () => {
    expect(isWebProject({ id: 'p1', templateType: 'next-app' })).toBe(true);
  });

  it('returns false for a bun-lib project', () => {
    expect(isWebProject({ id: 'p1', templateType: 'bun-lib' })).toBe(false);
  });

  it('returns false for a blank project', () => {
    expect(isWebProject({ id: 'p1', templateType: 'blank' })).toBe(false);
  });

  it('returns false when templateType is null', () => {
    expect(isWebProject({ id: 'p1', templateType: null })).toBe(false);
  });

  it('returns false for content/sales/support templates', () => {
    expect(isWebProject({ id: 'p1', templateType: 'content-marketing' })).toBe(false);
    expect(isWebProject({ id: 'p1', templateType: 'sales-outbound' })).toBe(false);
    expect(isWebProject({ id: 'p1', templateType: 'customer-support' })).toBe(false);
    expect(isWebProject({ id: 'p1', templateType: 'knowledge-base' })).toBe(false);
  });

  it('returns false for the AM board pseudo-project regardless of templateType', () => {
    expect(isWebProject({ id: AM_BOARD_PROJECT_ID, templateType: 'next-app' })).toBe(false);
    expect(isWebProject({ id: AM_BOARD_PROJECT_ID, templateType: 'blank' })).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isWebProject(null)).toBe(false);
    expect(isWebProject(undefined)).toBe(false);
  });
});
