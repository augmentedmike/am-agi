import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { listProjects, createProject } from '@/db/projects';
import { broadcast } from '@/lib/ws-store';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  repoDir: z.string().min(1),
});

export async function GET() {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  return NextResponse.json(listProjects(db));
}

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const project = createProject(db, parsed.data);
  try { broadcast({ type: 'project_created', project }); } catch {}
  return NextResponse.json(project, { status: 201 });
}
