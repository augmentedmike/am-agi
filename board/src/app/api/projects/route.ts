import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { listProjects, createProject } from '@/db/projects';
import { broadcast } from '@/lib/ws-store';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  repoDir: z.string().min(1),
  versioned: z.boolean().optional(),
  isTest: z.boolean().optional(),
});

export async function GET() {
  const { db, sqlite } = getDb();
  return NextResponse.json(listProjects(db));
}

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const project = createProject(db, parsed.data);
    try { broadcast({ type: 'project_created', project }); } catch {}
    return NextResponse.json(project, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'A project with that name already exists.' }, { status: 409 });
    }
    throw err;
  }
}
