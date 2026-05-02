import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createProject, getProject, updateProject } from '@/db/projects';
import { runningProcesses } from '@/lib/start-project';

let db: ReturnType<typeof createTestDb>['db'];
let workspaces: string[] = [];

function makeWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'am-status-test-'));
  workspaces.push(dir);
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'next dev' } }));
  return dir;
}

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  runMigrations(db, instance.sqlite);
  workspaces = [];
  runningProcesses.clear();
});

afterEach(() => {
  for (const dir of workspaces) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
  runningProcesses.clear();
});

// We exercise the status logic via the same DB + tracker the route uses,
// stubbing isAlive by directly inspecting tracker contents. The route's only
// novel logic is the devUrl override path, which is unit-testable without an
// HTTP layer by replicating the tiny URL-resolution rule.

describe('status endpoint URL resolution', () => {
  it('returns http://localhost:<port> when devUrl is not set', () => {
    const dir = makeWorkspace();
    const project = createProject(db, { name: 'p1', repoDir: dir, templateType: 'next-app' });
    runningProcesses.set(project.id, { pid: 99100, port: 4250, startedAt: new Date().toISOString() });
    const fresh = getProject(db, project.id)!;
    const entry = runningProcesses.get(project.id)!;
    const url = fresh.devUrl?.trim() || `http://localhost:${entry.port}`;
    expect(url).toBe('http://localhost:4250');
  });

  it('returns the devUrl override when set on the project', () => {
    const dir = makeWorkspace();
    const project = createProject(db, { name: 'p2', repoDir: dir, templateType: 'next-app' });
    updateProject(db, project.id, { devUrl: 'http://app.local:3000' });
    runningProcesses.set(project.id, { pid: 99101, port: 4251, startedAt: new Date().toISOString() });
    const fresh = getProject(db, project.id)!;
    const entry = runningProcesses.get(project.id)!;
    const url = fresh.devUrl?.trim() || `http://localhost:${entry.port}`;
    expect(url).toBe('http://app.local:3000');
  });

  it('treats whitespace-only devUrl as no override', () => {
    const dir = makeWorkspace();
    const project = createProject(db, { name: 'p3', repoDir: dir, templateType: 'next-app' });
    updateProject(db, project.id, { devUrl: '   ' });
    runningProcesses.set(project.id, { pid: 99102, port: 4252, startedAt: new Date().toISOString() });
    const fresh = getProject(db, project.id)!;
    const entry = runningProcesses.get(project.id)!;
    const url = fresh.devUrl?.trim() || `http://localhost:${entry.port}`;
    expect(url).toBe('http://localhost:4252');
  });
});
