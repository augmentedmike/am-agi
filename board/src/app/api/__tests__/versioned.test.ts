import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createProject, getProject, updateProject, listProjects } from '@/db/projects';

// All projects are versioned by default — versioned is not user-controllable

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

describe('DB schema — versioned column', () => {
  it('versioned column exists and SELECT works without error', () => {
    const proj = createProject(db, { name: 'test', repoDir: '/tmp/test' });
    const rows = listProjects(db);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const found = rows.find(r => r.id === proj.id);
    expect(found).toBeDefined();
    expect('versioned' in rows[0]).toBe(true);
  });

  it('new projects default to versioned = true', () => {
    const proj = createProject(db, { name: 'default-proj', repoDir: '/tmp/default' });
    const rows = listProjects(db);
    const found = rows.find(r => r.id === proj.id);
    expect(found).toBeDefined();
    expect(found?.versioned).toBe(true);
  });
});

describe('POST /api/projects — versioned defaults', () => {
  it('newly created project has versioned: true', () => {
    const proj = createProject(db, { name: 'new-proj', repoDir: '/tmp/new' });
    expect(proj.versioned).toBe(true);
  });
});

describe('PATCH /api/projects/:id — versioned is not user-controllable', () => {
  it('project remains versioned: true after update', () => {
    const proj = createProject(db, { name: 'hw', repoDir: '/tmp/hw' });
    expect(proj.versioned).toBe(true);
    updateProject(db, proj.id, { name: 'hw-updated' });
    const refetched = getProject(db, proj.id);
    expect(refetched?.versioned).toBe(true);
  });

  it('updateProject returns null for unknown id', () => {
    const result = updateProject(db, 'nonexistent', { name: 'nope' });
    expect(result).toBeNull();
  });
});

describe('GET /api/version — version string', () => {
  it('package.json has a non-empty version string', () => {
    const pkg = require('../../../../package.json') as { version: string };
    expect(typeof pkg.version).toBe('string');
    expect(pkg.version.length).toBeGreaterThan(0);
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ---------------------------------------------------------------------------
// semverSort / semverDesc — pure function tests
// ---------------------------------------------------------------------------

function semverSort(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [a0, a1, a2] = parse(a);
  const [b0, b1, b2] = parse(b);
  return a0 !== b0 ? a0 - b0 : a1 !== b1 ? a1 - b1 : a2 - b2;
}

function semverDesc(a: string, b: string): number {
  return semverSort(b, a);
}

describe('semverSort / semverDesc', () => {
  const versions = ['1.0.0', '0.9.0', '2.0.0', 'v1.5.0'];

  it('sorts ascending: 0.9.0, 1.0.0, 1.5.0, 2.0.0', () => {
    const sorted = [...versions].sort(semverSort);
    expect(sorted).toEqual(['0.9.0', '1.0.0', 'v1.5.0', '2.0.0']);
  });

  it('sorts descending: 2.0.0, 1.5.0, 1.0.0, 0.9.0', () => {
    const sorted = [...versions].sort(semverDesc);
    expect(sorted).toEqual(['2.0.0', 'v1.5.0', '1.0.0', '0.9.0']);
  });

  it('strips v-prefix correctly', () => {
    expect(semverSort('v1.5.0', '1.5.0')).toBe(0);
    expect(semverDesc('v1.5.0', '1.5.0')).toBe(0);
  });

  it('handles equal versions', () => {
    expect(semverSort('1.2.3', '1.2.3')).toBe(0);
  });

  it('treats empty string as older than any real version', () => {
    // parse('') → major=0, minor=undefined, patch=undefined
    // When major differs, comparison stops at major — so 1.x vs 0.x works correctly
    expect(semverSort('1.0.0', '')).toBeGreaterThan(0); // '' sorts before 1.0.0 ascending
    expect(semverDesc('1.0.0', '')).toBeLessThan(0);    // 1.0.0 sorts first descending (newer)
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/versions — DB-level logic
// ---------------------------------------------------------------------------

describe('GET /api/projects/:id/versions — DB logic', () => {
  it('returns sorted versions and currentVersion when cards exist', () => {
    const proj = createProject(db, { name: 'versioned-proj', repoDir: '/tmp/vp' });
    const now = new Date().toISOString();
    for (const [id, ver] of [['c1', '1.0.0'], ['c2', '2.0.0'], ['c3', '0.9.0']] as const) {
      sqlite.prepare(`INSERT INTO cards (id, title, state, priority, attachments, work_log, project_id, version, card_type, entity_fields, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, `Card ${id}`, 'backlog', 'normal', '[]', '[]', proj.id, ver, 'task', '{}', now, now
      );
    }

    const rows = sqlite.prepare(
      `SELECT DISTINCT version FROM cards WHERE project_id = ? AND version IS NOT NULL AND version != '' AND archived = 0`
    ).all(proj.id) as { version: string }[];
    const versionSet = new Set(rows.map(r => r.version));
    const project = getProject(db, proj.id);
    if (project?.currentVersion) versionSet.add(project.currentVersion);
    const versions = Array.from(versionSet).sort(semverSort);

    expect(versions).toEqual(['0.9.0', '1.0.0', '2.0.0']);
    expect(project?.currentVersion ?? null).toBeNull();
  });

  it('includes currentVersion even if no card has it', () => {
    const proj = createProject(db, { name: 'proj-cv', repoDir: '/tmp/cv' });
    updateProject(db, proj.id, { currentVersion: '3.0.0' });

    const rows = sqlite.prepare(
      `SELECT DISTINCT version FROM cards WHERE project_id = ? AND version IS NOT NULL AND version != '' AND archived = 0`
    ).all(proj.id) as { version: string }[];
    const versionSet = new Set(rows.map(r => r.version));
    const project = getProject(db, proj.id);
    if (project?.currentVersion) versionSet.add(project.currentVersion);
    const versions = Array.from(versionSet).sort(semverSort);

    expect(versions).toContain('3.0.0');
    expect(project?.currentVersion).toBe('3.0.0');
  });
});

// ---------------------------------------------------------------------------
// Card creation → auto-advance currentVersion
// ---------------------------------------------------------------------------

/** Replicates the auto-advance logic from POST /api/cards */
function autoAdvanceVersion(
  advDb: ReturnType<typeof createTestDb>['db'],
  advSqlite: ReturnType<typeof createTestDb>['sqlite'],
  card: { version: string | null; projectId: string }
) {
  if (!card.version || !card.projectId) return;
  const project = getProject(advDb, card.projectId);
  if (!project?.versioned || card.version === project.currentVersion) return;
  const { cnt } = advSqlite.prepare(
    `SELECT COUNT(*) as cnt FROM cards WHERE project_id = ? AND version = ? AND archived = 0`
  ).get(card.projectId, card.version) as { cnt: number };
  if (cnt <= 1) {
    updateProject(advDb, card.projectId, { currentVersion: card.version });
  }
}

describe('Card creation → auto-advance currentVersion', () => {
  const now = new Date().toISOString();

  it('creates a card with a brand-new version and advances project.currentVersion', () => {
    const proj = createProject(db, { name: 'proj-aa', repoDir: '/tmp/aa' });
    expect(getProject(db, proj.id)?.currentVersion).toBeNull();

    sqlite.prepare(`INSERT INTO cards (id, title, state, priority, attachments, work_log, project_id, version, card_type, entity_fields, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'ca1', 'New card', 'backlog', 'normal', '[]', '[]', proj.id, '1.0.0', 'task', '{}', now, now
    );
    autoAdvanceVersion(db, sqlite, { version: '1.0.0', projectId: proj.id });

    expect(getProject(db, proj.id)?.currentVersion).toBe('1.0.0');
  });

  it('does NOT change currentVersion when card version matches existing currentVersion', () => {
    const proj = createProject(db, { name: 'proj-no-advance', repoDir: '/tmp/na' });
    updateProject(db, proj.id, { currentVersion: '1.0.0' });

    sqlite.prepare(`INSERT INTO cards (id, title, state, priority, attachments, work_log, project_id, version, card_type, entity_fields, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'ca2', 'Same version card', 'backlog', 'normal', '[]', '[]', proj.id, '1.0.0', 'task', '{}', now, now
    );
    autoAdvanceVersion(db, sqlite, { version: '1.0.0', projectId: proj.id });

    expect(getProject(db, proj.id)?.currentVersion).toBe('1.0.0');
  });

  it('does NOT change currentVersion when card has no version', () => {
    const proj = createProject(db, { name: 'proj-no-ver', repoDir: '/tmp/nv' });
    updateProject(db, proj.id, { currentVersion: '2.0.0' });

    sqlite.prepare(`INSERT INTO cards (id, title, state, priority, attachments, work_log, project_id, version, card_type, entity_fields, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'ca3', 'No version card', 'backlog', 'normal', '[]', '[]', proj.id, null, 'task', '{}', now, now
    );
    autoAdvanceVersion(db, sqlite, { version: null, projectId: proj.id });

    expect(getProject(db, proj.id)?.currentVersion).toBe('2.0.0');
  });
});
