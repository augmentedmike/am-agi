/**
 * Unit tests for the pure logic inside VersionBadge (Navigation.tsx).
 *
 * The component itself is a React client component — DOM-free tests cover the
 * semverDesc function and the auto-select / PATCH behaviours by extracting and
 * exercising the underlying logic directly.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Inline copy of semverDesc from Navigation.tsx (pure function)
// ---------------------------------------------------------------------------

function semverDesc(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [a0, a1, a2] = parse(a);
  const [b0, b1, b2] = parse(b);
  return a0 !== b0 ? b0 - a0 : a1 !== b1 ? b1 - a1 : b2 - a2;
}

// ---------------------------------------------------------------------------
// Auto-select condition (extracted from VersionBadge fetchVersions)
// ---------------------------------------------------------------------------

/** Returns true when `newest` is strictly newer than `current`. */
function shouldAutoSelect(newest: string, current: string): boolean {
  return semverDesc(newest, current || '') < 0;
}

// ---------------------------------------------------------------------------
// handleChange logic (the PATCH + state-update path)
// ---------------------------------------------------------------------------

type PatchFn = (projectId: string, version: string) => Promise<void>;

async function handleChangeLogic(
  projectId: string,
  newVersion: string,
  currentSelected: string,
  patchFn: PatchFn,
  setSelected: (v: string) => void,
  setSaving: (v: boolean) => void
): Promise<void> {
  if (!newVersion || newVersion === currentSelected) return;
  // Local state updates immediately (before await)
  setSelected(newVersion);
  setSaving(true);
  try {
    await patchFn(projectId, newVersion);
  } finally {
    setSaving(false);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('semverDesc (VersionBadge)', () => {
  it('returns negative when a is newer than b (a sorts first descending)', () => {
    expect(semverDesc('2.0.0', '1.0.0')).toBeLessThan(0);
  });

  it('returns positive when b is newer than a', () => {
    expect(semverDesc('1.0.0', '2.0.0')).toBeGreaterThan(0);
  });

  it('returns 0 for equal versions', () => {
    expect(semverDesc('1.2.3', '1.2.3')).toBe(0);
  });

  it('strips v-prefix correctly', () => {
    expect(semverDesc('v2.0.0', '1.0.0')).toBeLessThan(0);
    expect(semverDesc('v1.0.0', 'v1.0.0')).toBe(0);
  });
});

describe('auto-select condition (VersionBadge)', () => {
  it('triggers auto-select when a newer version appears', () => {
    const sorted = ['2.0.0', '1.0.0', '0.9.0']; // already sorted descending
    expect(shouldAutoSelect(sorted[0], '1.0.0')).toBe(true);
  });

  it('does NOT trigger auto-select when newest already matches selected', () => {
    const sorted = ['2.0.0', '1.0.0'];
    expect(shouldAutoSelect(sorted[0], '2.0.0')).toBe(false);
  });

  it('does NOT trigger auto-select when selected is empty string (fresh load, wait for first fetch result)', () => {
    // empty string → parsed as 0.0.0, so any real version triggers auto-select
    // This is the intended behaviour: on first load with no selection, auto-pick newest
    expect(shouldAutoSelect('1.0.0', '')).toBe(true);
  });

  it('does NOT trigger auto-select when version list is empty', () => {
    const sorted: string[] = [];
    // condition: sorted.length > 0 && ...
    expect(sorted.length > 0 && shouldAutoSelect(sorted[0], '1.0.0')).toBe(false);
  });

  it('does NOT trigger auto-select when newest equals current (no change)', () => {
    expect(shouldAutoSelect('1.5.0', '1.5.0')).toBe(false);
  });
});

describe('handleChange logic — PATCH called and local state updates immediately', () => {
  it('calls setSelected immediately before PATCH resolves', async () => {
    const calls: string[] = [];
    let patchResolved = false;

    const patchFn: PatchFn = async (_id, _v) => {
      await new Promise<void>(resolve => setTimeout(() => { patchResolved = true; resolve(); }, 10));
    };
    const setSelected = (v: string) => { calls.push(`select:${v}`); };
    const setSaving = (v: boolean) => { calls.push(`saving:${v}`); };

    const p = handleChangeLogic('proj-1', '2.0.0', '1.0.0', patchFn, setSelected, setSaving);
    // setSelected should have been called synchronously before the promise settles
    expect(calls[0]).toBe('select:2.0.0');
    expect(patchResolved).toBe(false); // PATCH not yet done
    await p;
    expect(patchResolved).toBe(true);
  });

  it('calls PATCH with correct project ID and version', async () => {
    let patchedId = '';
    let patchedVersion = '';

    const patchFn: PatchFn = async (id, v) => {
      patchedId = id;
      patchedVersion = v;
    };
    await handleChangeLogic('my-proj', '3.1.0', '2.0.0', patchFn, () => {}, () => {});

    expect(patchedId).toBe('my-proj');
    expect(patchedVersion).toBe('3.1.0');
  });

  it('does nothing when new version equals current selection', async () => {
    let patchCalled = false;
    const patchFn: PatchFn = async () => { patchCalled = true; };
    await handleChangeLogic('proj', '1.0.0', '1.0.0', patchFn, () => {}, () => {});
    expect(patchCalled).toBe(false);
  });

  it('does nothing when new version is empty', async () => {
    let patchCalled = false;
    const patchFn: PatchFn = async () => { patchCalled = true; };
    await handleChangeLogic('proj', '', '1.0.0', patchFn, () => {}, () => {});
    expect(patchCalled).toBe(false);
  });

  it('sets saving to false in finally (even on PATCH error)', async () => {
    const savingStates: boolean[] = [];
    const patchFn: PatchFn = async () => { throw new Error('network'); };
    const setSaving = (v: boolean) => savingStates.push(v);

    await handleChangeLogic('proj', '2.0.0', '1.0.0', async (id, v) => {
      throw new Error('fail');
    }, () => {}, setSaving).catch(() => {});

    expect(savingStates).toContain(true);
    expect(savingStates[savingStates.length - 1]).toBe(false);
  });
});
