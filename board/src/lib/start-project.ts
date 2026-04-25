import { spawn as nodeSpawn, type SpawnOptions } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { findFreePort as defaultFindFreePort, DEFAULT_DEV_PORT_BASE } from './free-port';
import { updateProject } from '@/db/projects';

export type RunningProcess = { pid: number; port: number; startedAt: string };

/** Module-level in-memory tracker of running dev servers, keyed by project id. */
export const runningProcesses = new Map<string, RunningProcess>();

export type StartProjectResult =
  | { ok: false; status: 400; error: string }
  | {
      ok: true;
      status: 'started' | 'already-running';
      url: string;
      pid: number;
      port: number;
    };

export type ProjectLike = {
  id: string;
  repoDir: string;
  devPort?: number | null;
  prodPort?: number | null;
};

export type SpawnFn = (
  cmd: string,
  args: readonly string[],
  options: SpawnOptions,
) => { pid?: number | undefined; unref: () => void };

export type StartProjectDeps = {
  /** Override the in-memory tracker (used by tests to isolate state). */
  tracker?: Map<string, RunningProcess>;
  /** Spawn implementation — defaults to `child_process.spawn`. */
  spawn?: SpawnFn;
  /** Returns true iff the given PID corresponds to a still-alive process. */
  isAlive?: (pid: number) => boolean;
  /** Free-port finder; defaults to the implementation in `./free-port`. */
  findFreePort?: (start: number) => Promise<number>;
  /** Update-project hook; defaults to the real DB updater. Used by tests. */
  persistDevPort?: (id: string, port: number) => void;
};

function expandPath(p: string): string {
  return p.replace(/^~/, homedir());
}

function defaultIsAlive(pid: number): boolean {
  try {
    // signal 0 is a permission-check probe — does not actually deliver a signal
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function detectFramework(pkg: Record<string, unknown>): 'next' | 'vite' | null {
  const deps = { ...(pkg.dependencies as object ?? {}), ...(pkg.devDependencies as object ?? {}) } as Record<string, string>;
  if ('next' in deps) return 'next';
  if ('vite' in deps) return 'vite';
  return null;
}

function buildCommand(framework: 'next' | 'vite', port: number): { cmd: string; args: string[] } {
  if (framework === 'next') {
    return { cmd: 'npx', args: ['next', 'dev', '--port', String(port)] };
  }
  return { cmd: 'npx', args: ['vite', '--port', String(port), '--host'] };
}

/**
 * Core logic behind `POST /api/projects/[id]/start`. Validates the project,
 * allocates a port if needed, spawns the dev server detached, and tracks the
 * resulting PID so that subsequent calls return `already-running` instead of
 * spawning duplicates.
 */
export async function startProject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  project: ProjectLike,
  deps: StartProjectDeps = {},
): Promise<StartProjectResult> {
  const tracker = deps.tracker ?? runningProcesses;
  const spawnFn = deps.spawn ?? (nodeSpawn as unknown as SpawnFn);
  const isAlive = deps.isAlive ?? defaultIsAlive;
  const findFree = deps.findFreePort ?? defaultFindFreePort;
  const persist = deps.persistDevPort ?? ((id: string, port: number) => { updateProject(db, id, { devPort: port }); });

  // 1. Validate repoDir
  const repoDir = expandPath(project.repoDir);
  if (!repoDir || !existsSync(repoDir)) {
    return { ok: false, status: 400, error: 'repoDir does not exist on disk' };
  }
  const pkgPath = path.join(repoDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return { ok: false, status: 400, error: 'package.json not found in repoDir' };
  }

  // 2. Validate framework
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, error: 'package.json is not valid JSON' };
  }
  const framework = detectFramework(pkg);
  if (!framework) {
    return { ok: false, status: 400, error: 'project is not a web app (no next or vite dependency)' };
  }

  // 3. Already running?
  const existing = tracker.get(project.id);
  if (existing && isAlive(existing.pid)) {
    return {
      ok: true,
      status: 'already-running',
      url: `http://localhost:${existing.port}`,
      pid: existing.pid,
      port: existing.port,
    };
  }
  if (existing) {
    // stale entry — clear before spawning a new one
    tracker.delete(project.id);
  }

  // 4. Allocate port
  let port = project.devPort;
  if (port == null) {
    const base = project.prodPort != null ? project.prodPort + 1 : DEFAULT_DEV_PORT_BASE;
    port = await findFree(base);
    persist(project.id, port);
  }

  // 5. Spawn detached
  const { cmd, args } = buildCommand(framework, port);
  const child = spawnFn(cmd, args, {
    cwd: repoDir,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(port) },
  });
  if (typeof child.pid !== 'number') {
    return { ok: false, status: 400, error: 'failed to spawn dev server' };
  }
  child.unref();

  const record: RunningProcess = { pid: child.pid, port, startedAt: new Date().toISOString() };
  tracker.set(project.id, record);

  return {
    ok: true,
    status: 'started',
    url: `http://localhost:${port}`,
    pid: child.pid,
    port,
  };
}
