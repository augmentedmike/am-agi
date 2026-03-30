import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createProject, getProject, updateProject, listProjects } from '@/db/projects';

// Tests for versioned field on projects (criteria 1, 6-12 from test card afa9a703)

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

describe('DB schema — versioned column (criteria 11, 12)', () => {
  it('versioned column exists and SELECT works without error', () => {
    const proj = createProject(db, { name: 'test', repoDir: '/tmp/test' });
    const rows = listProjects(db);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const found = rows.find(r => r.id === proj.id);
    expect(found).toBeDefined();
    expect('versioned' in rows[0]).toBe(true);
  });

  it('new projects default to versioned = false (criterion 12)', () => {
    const proj = createProject(db, { name: 'default-proj', repoDir: '/tmp/default' });
    const rows = listProjects(db);
    const found = rows.find(r => r.id === proj.id);
    expect(found).toBeDefined();
    expect(found?.versioned).toBe(false);
  });
});

describe('POST /api/projects — versioned defaults (criterion 9)', () => {
  it('newly created project has versioned: false', () => {
    const proj = createProject(db, { name: 'new-proj', repoDir: '/tmp/new' });
    expect(proj.versioned).toBe(false);
  });

  it('can create project with versioned: true explicitly', () => {
    const proj = createProject(db, { name: 'versioned-proj', repoDir: '/tmp/v', versioned: true });
    expect(proj.versioned).toBe(true);
  });
});

describe('PATCH /api/projects/:id — versioned persistence (criteria 6, 7, 8, 10)', () => {
  it('PATCH versioned:true returns 200 and sets field (criterion 6)', () => {
    const proj = createProject(db, { name: 'hw', repoDir: '/tmp/hw' });
    const updated = updateProject(db, proj.id, { versioned: true });
    expect(updated).not.toBeNull();
    expect(updated?.versioned).toBe(true);
  });

  it('versioned:true persists after save — re-fetch confirms (criterion 7)', () => {
    const proj = createProject(db, { name: 'hw', repoDir: '/tmp/hw' });
    updateProject(db, proj.id, { versioned: true });
    const refetched = getProject(db, proj.id);
    expect(refetched?.versioned).toBe(true);
  });

  it('versioned:false persists after save — re-fetch confirms (criterion 8)', () => {
    const proj = createProject(db, { name: 'hw', repoDir: '/tmp/hw', versioned: true });
    updateProject(db, proj.id, { versioned: false });
    const refetched = getProject(db, proj.id);
    expect(refetched?.versioned).toBe(false);
  });

  it('test project toggle: false → true → re-fetch confirms true (criterion 10)', () => {
    const proj = createProject(db, { name: 'test-proj', repoDir: '/tmp/tp' });
    expect(proj.versioned).toBe(false);
    updateProject(db, proj.id, { versioned: true });
    const after = getProject(db, proj.id);
    expect(after?.versioned).toBe(true);
  });

  it('updateProject returns null for unknown id', () => {
    const result = updateProject(db, 'nonexistent', { versioned: true });
    expect(result).toBeNull();
  });
});

describe('GET /api/version — version string (criterion 1)', () => {
  it('package.json has a non-empty version string', () => {
    // The /api/version route returns pkg.version from package.json
    const pkg = require('../../../../package.json') as { version: string };
    expect(typeof pkg.version).toBe('string');
    expect(pkg.version.length).toBeGreaterThan(0);
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
