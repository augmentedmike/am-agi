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
