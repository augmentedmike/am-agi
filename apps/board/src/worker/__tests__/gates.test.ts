import { describe, it, expect } from 'bun:test';
import { checkGate } from '../gates';

const makeCard = (overrides: Partial<Parameters<typeof checkGate>[0]> = {}): Parameters<typeof checkGate>[0] => ({
  state: 'backlog',
  attachments: [],
  workDir: null,
  ...overrides,
});

describe('gates', () => {
  it('backlog→in-progress: fails without attachments', () => {
    const result = checkGate(makeCard({ state: 'backlog' }), 'in-progress');
    expect(result.allowed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it('in-review→in-progress: always allowed', () => {
    const result = checkGate(makeCard({ state: 'in-review' }), 'in-progress');
    expect(result.allowed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('invalid transition: not allowed', () => {
    const result = checkGate(makeCard({ state: 'shipped' }), 'backlog');
    expect(result.allowed).toBe(false);
  });
});
