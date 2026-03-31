import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { getDb } from '@/db/client';
import { getProject, updateProject, deleteProject } from '@/db/projects';
import { getSetting } from '@/db/settings';
import { broadcast } from '@/lib/ws-store';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  repoDir: z.string().min(1).optional(),
  versioned: z.boolean().optional(),
  isTest: z.boolean().optional(),
  githubRepo: z.string().optional(),
  vercelUrl: z.string().optional(),
  currentVersion: z.string().optional(),
  templateType: z.string().optional(),
  defaultBranch: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const existing = getProject(db, id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let project;
  try {
    project = updateProject(db, id, parsed.data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'A project with that name already exists.' }, { status: 409 });
    }
    throw err;
  }
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Backfill unversioned cards when versioning is enabled and a currentVersion now exists
  if (project.versioned && project.currentVersion && !existing.currentVersion) {
    sqlite.prepare(
      `UPDATE cards SET version = ?, updated_at = datetime('now') WHERE project_id = ? AND (version IS NULL OR version = '')`
    ).run(project.currentVersion, id);
  }

  const expand = (p: string) => p.replace(/^~/, homedir());

  // Rename workspace directory on disk if repoDir changed
  if (parsed.data.repoDir && parsed.data.repoDir !== existing.repoDir) {
    const oldDir = expand(existing.repoDir);
    const newDir = expand(project.repoDir);
    if (existsSync(oldDir)) {
      try { renameSync(oldDir, newDir); } catch { /* directory may be in use or cross-device — skip */ }
    }
  }

  // Clone if githubRepo was just added and the workspace directory doesn't exist yet
  const repoWasAdded = parsed.data.githubRepo && !existing.githubRepo;
  if (repoWasAdded && project.repoDir) {
    const repoDir = expand(project.repoDir);
    if (!existsSync(repoDir)) {
      try {
        const token = getSetting(db, 'github_token');
        const repoSlug = project.githubRepo!.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
        const cloneUrl = token
          ? `https://${token}@github.com/${repoSlug}.git`
          : `https://github.com/${repoSlug}.git`;
        const parentDir = repoDir.substring(0, repoDir.lastIndexOf('/'));
        mkdirSync(parentDir, { recursive: true });
        const branchFlag = project.defaultBranch ? ` -b "${project.defaultBranch}"` : '';
        execSync(`git clone --depth 1${branchFlag} "${cloneUrl}" "${repoDir}"`, { timeout: 60000 });
      } catch { /* non-fatal */ }
    }
  }

  broadcast({ type: 'project_updated', project });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  if (!getProject(db, id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // Archive all cards belonging to this project before deleting it.
  // Cards must never become orphaned (NULL project_id causes them to bleed into all-projects view).
  sqlite.prepare(`UPDATE cards SET archived = 1, updated_at = datetime('now') WHERE project_id = ? AND archived = 0`).run(id);
  deleteProject(db, id);
  broadcast({ type: 'project_deleted', id });
  return new NextResponse(null, { status: 204 });
}
