/**
 * Tests for bin/deslop — the AI-slop cleaner script.
 *
 * These tests verify the script's structure and behaviour without actually
 * invoking Claude, so they run fast and offline.
 */
import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(import.meta.dir, '..');
const DESLOP_PATH = join(REPO_ROOT, 'bin', 'deslop');

const script = readFileSync(DESLOP_PATH, 'utf8');

describe('bin/deslop — script structure', () => {
  it('uses git diff --name-only to detect changed files', () => {
    expect(script).toContain('git diff --name-only');
  });

  it('reads the deslop skill file from .claude/commands/deslop.md', () => {
    expect(script).toContain('.claude/commands/deslop.md');
  });

  it('invokes claude --print with the skill content', () => {
    expect(script).toContain('claude --print');
  });

  it('exits 1 when skill file is missing', () => {
    expect(script).toContain('exit 1');
    // The guard for missing skill file
    expect(script).toContain('skill not found');
  });

  it('handles no changed files gracefully (no-op)', () => {
    expect(script).toContain('nothing to do');
  });

  it('compares changed files against origin/dev branch point', () => {
    expect(script).toContain('git merge-base HEAD origin/dev');
  });

  it('filters to code file extensions only (.ts .tsx .js .jsx .py .rs .go)', () => {
    expect(script).toMatch(/\\\.\(ts\|tsx\|js\|jsx\|py\|rs\|go\)\$/);
  });
});

describe('bin/deslop — CLAUDE.md mandates deslop before criteria check', () => {
  it('CLAUDE.md in-review column definition runs deslop first', () => {
    const claudeMd = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
    // Verify the in-review row mandates deslop before criteria verification
    const inReviewLine = claudeMd.split('\n').find(l => l.includes('in-review') && l.includes('deslop'));
    expect(inReviewLine).toBeDefined();
    // deslop must appear before "criteria" in that line
    if (inReviewLine) {
      const deslopIdx = inReviewLine.indexOf('deslop');
      const criteriaIdx = inReviewLine.indexOf('criteria');
      expect(deslopIdx).toBeLessThan(criteriaIdx);
    }
  });
});
