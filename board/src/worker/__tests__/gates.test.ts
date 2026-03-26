import { describe, it, expect } from 'bun:test';
import { checkGate, type State } from '../gates';
import { resolve } from 'node:path';

function makeCard(overrides: { state?: State; attachments?: string[] } = {}) {
  return { id: 'test-1', title: 'Test', state: 'backlog' as State, priority: 'normal', attachments: [] as string[], ...overrides };
}

describe('gates', () => {
  it('backlog→in-progress: fails without attachments', async () => {
    const card = makeCard({ state: 'backlog' });
    const result = await checkGate('backlog', 'in-progress', card, '');
    expect(result.allowed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it('in-review→in-progress: always allowed', async () => {
    const card = makeCard({ state: 'in-review' });
    const result = await checkGate('in-review', 'in-progress', card, '');
    expect(result.allowed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('invalid transition: not allowed', async () => {
    const card = makeCard({ state: 'shipped' });
    const result = await checkGate('shipped' as State, 'backlog' as State, card, '');
    expect(result.allowed).toBe(false);
  });

  it('backlog→in-progress: fileAttached prefers existing absolute path over non-existing relative', async () => {
    // The worktree root criteria.md is a real file that ends with "criteria.md"
    const absPath = resolve(import.meta.dir, '../../../../criteria.md');
    const card = makeCard({
      state: 'backlog',
      // relative "criteria.md" comes first (doesn't exist at cwd); absolute path exists
      attachments: ['criteria.md', absPath],
    });
    const result = await checkGate('backlog', 'in-progress', card, '');
    // The gate should use the absolute path and not report "must be attached and exist"
    const hasMissingError = result.failures.some(f => f.includes('criteria.md must be attached and exist'));
    expect(hasMissingError).toBe(false);
  });
});
