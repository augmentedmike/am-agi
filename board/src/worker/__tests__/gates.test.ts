import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkGate, type State } from '../gates';

function makeCard(overrides: { state?: State; attachments?: string[] } = {}) {
  return { id: 'test-1', title: 'Test', state: 'backlog' as State, priority: 'normal', attachments: [] as string[], ...overrides };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `gates-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

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
    // Write criteria.md with numbered items in a temp dir
    const absPath = join(tmpDir, 'criteria.md');
    writeFileSync(absPath, '1. Do the thing\n2. Test it\n', 'utf8');
    // Also write research.md so the gate does not fail on that check
    writeFileSync(join(tmpDir, 'research.md'), 'See src/worker/gates.ts for context.\n', 'utf8');
    const card = makeCard({
      state: 'backlog',
      // relative "criteria.md" comes first (doesn't exist at cwd); absolute path exists
      attachments: ['criteria.md', absPath, join(tmpDir, 'research.md')],
    });
    const result = await checkGate('backlog', 'in-progress', card, '');
    // The gate should use the absolute path and not report "must be attached and exist"
    const hasMissingError = result.failures.some(f => f.includes('criteria.md must be attached and exist'));
    expect(hasMissingError).toBe(false);
  });
});
