import { describe, it, expect } from 'bun:test';
import { checkGate, type State } from '../gates';

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
});
