import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getProject, updateProject } from '@/db/projects';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expandPath(p: string): string {
  return p.replace(/^~/, homedir());
}

function detectFromGit(repoDir: string): string | null {
  try {
    const result = execSync('git describe --tags --abbrev=0', {
      cwd: repoDir,
      timeout: 5000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

function detectFromPackageJson(repoDir: string): string | null {
  try {
    const pkgPath = path.join(repoDir, 'package.json');
    if (!existsSync(pkgPath)) return null;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!project.repoDir) return NextResponse.json({ detected: null });

  const repoDir = expandPath(project.repoDir);
  if (!existsSync(repoDir)) return NextResponse.json({ detected: null });

  const detected = detectFromGit(repoDir) ?? detectFromPackageJson(repoDir);

  // Auto-update currentVersion in DB if detected version differs from stored
  if (detected && detected !== project.currentVersion) {
    updateProject(db, id, { currentVersion: detected });
  }

  return NextResponse.json({ detected });
}
