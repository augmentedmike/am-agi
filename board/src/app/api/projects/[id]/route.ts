import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getProject, updateProject, deleteProject } from '@/db/projects';
import { broadcast } from '@/lib/ws-store';
import { z } from 'zod';
import { existsSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  repoDir: z.string().min(1).optional(),
  versioned: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const existing = getProject(db, id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const project = updateProject(db, id, parsed.data);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Rename workspace directory on disk if repoDir changed
  if (parsed.data.repoDir && parsed.data.repoDir !== existing.repoDir) {
    const expand = (p: string) => p.replace(/^~/, homedir());
    const oldDir = expand(existing.repoDir);
    const newDir = expand(project.repoDir);
    if (existsSync(oldDir)) {
      try { renameSync(oldDir, newDir); } catch { /* directory may be in use or cross-device — skip */ }
    }
  }

  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  if (!getProject(db, id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  deleteProject(db, id);
  broadcast({ type: 'project_deleted', id });
  return new NextResponse(null, { status: 204 });
}
