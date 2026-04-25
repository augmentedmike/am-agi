import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createProject, getProject } from '@/db/projects';
import { startProject, type RunningProcess, type SpawnFn } from '@/lib/start-project';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let workspaces: string[] = [];

function makeWorkspace(pkg: object | null): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'am-start-test-'));
  workspaces.push(dir);
  if (pkg !== null) {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  }
  return dir;
}

function makeSpawn(pid: number): SpawnFn {
  return () => ({ pid, unref: () => {} });
}

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
  workspaces = [];
});

afterEach(() => {
  for (const dir of workspaces) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

describe('POST /api/projects/[id]/start', () => {
  it('returns 404 when project does not exist', () => {
    // Mirrors the route's first guard: getProject(db, id) returns undefined → 404.
    expect(getProject(db, 'nope')).toBeUndefined();
  });

  it('returns 400 when repoDir does not exist on disk', async () => {
    const project = createProject(db, { name: 'p1', repoDir: '/no/such/dir', templateType: 'next-app' });
    const result = await startProject(db, project, { tracker: new Map() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/repoDir/);
  });

  it('returns 400 when package.json is missing', async () => {
    const dir = makeWorkspace(null);
    const project = createProject(db, { name: 'p2', repoDir: dir, templateType: 'next-app' });
    const result = await startProject(db, project, { tracker: new Map() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/package\.json/);
  });

  it('returns 400 when package.json has no next or vite dependency', async () => {
    const dir = makeWorkspace({ name: 'lib', dependencies: { lodash: '^4.0.0' } });
    const project = createProject(db, { name: 'p3', repoDir: dir, templateType: 'blank' });
    const result = await startProject(db, project, { tracker: new Map() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/web app|next|vite/);
  });

  it('starts a next-app project and returns started + url + pid + port', async () => {
    const dir = makeWorkspace({ name: 'web', dependencies: { next: '^14.0.0' } });
    const project = createProject(db, { name: 'p4', repoDir: dir, templateType: 'next-app' });
    const tracker = new Map<string, RunningProcess>();
    const result = await startProject(db, project, {
      tracker,
      spawn: makeSpawn(99001),
      isAlive: () => true,
      findFreePort: async () => 4203,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('started');
    expect(result.pid).toBe(99001);
    expect(result.port).toBe(4203);
    expect(result.url).toBe('http://localhost:4203');
    expect(tracker.get(project.id)).toBeDefined();
  });

  it('persists allocated devPort to the project when not previously set', async () => {
    const dir = makeWorkspace({ name: 'web', devDependencies: { next: '^14.0.0' } });
    const project = createProject(db, { name: 'p5', repoDir: dir, templateType: 'next-app' });
    const result = await startProject(db, project, {
      tracker: new Map(),
      spawn: makeSpawn(99002),
      isAlive: () => true,
      findFreePort: async () => 4210,
    });
    expect(result.ok).toBe(true);
    const refreshed = getProject(db, project.id);
    expect(refreshed?.devPort).toBe(4210);
  });

  it('returns already-running on the second call when tracker entry is alive', async () => {
    const dir = makeWorkspace({ name: 'web', dependencies: { next: '^14.0.0' } });
    const project = createProject(db, { name: 'p6', repoDir: dir, templateType: 'next-app' });
    const tracker = new Map<string, RunningProcess>();
    let spawnCalls = 0;
    const spawn: SpawnFn = () => { spawnCalls++; return { pid: 99003, unref: () => {} }; };

    const first = await startProject(db, project, {
      tracker,
      spawn,
      isAlive: () => true,
      findFreePort: async () => 4220,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const fresh = getProject(db, project.id);
    const second = await startProject(db, fresh!, {
      tracker,
      spawn,
      isAlive: () => true,
      findFreePort: async () => 9999, // should NOT be used
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.status).toBe('already-running');
    expect(second.port).toBe(first.port);
    expect(second.pid).toBe(first.pid);
    expect(spawnCalls).toBe(1);
  });

  it('respawns when the previously tracked PID is no longer alive', async () => {
    const dir = makeWorkspace({ name: 'web', dependencies: { vite: '^5.0.0' } });
    const project = createProject(db, { name: 'p7', repoDir: dir, templateType: 'next-app' });
    const tracker = new Map<string, RunningProcess>();
    tracker.set(project.id, { pid: 12345, port: 4203, startedAt: new Date().toISOString() });

    const result = await startProject(db, project, {
      tracker,
      spawn: makeSpawn(99004),
      isAlive: () => false,
      findFreePort: async () => 4205,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe('started');
    expect(result.pid).toBe(99004);
  });

  it('uses prodPort+1 as the base when devPort is null and prodPort is set', async () => {
    const dir = makeWorkspace({ name: 'web', dependencies: { next: '^14.0.0' } });
    const project = createProject(db, { name: 'p8', repoDir: dir, templateType: 'next-app' });
    sqlite.prepare('UPDATE projects SET prod_port = ? WHERE id = ?').run(5000, project.id);
    const fresh = getProject(db, project.id)!;
    let probedBase = -1;
    const result = await startProject(db, fresh, {
      tracker: new Map(),
      spawn: makeSpawn(99005),
      isAlive: () => true,
      findFreePort: async (base) => { probedBase = base; return base; },
    });
    expect(result.ok).toBe(true);
    expect(probedBase).toBe(5001);
  });
});
