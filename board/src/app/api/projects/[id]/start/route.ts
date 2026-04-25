import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';
import { startProject } from '@/lib/start-project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const result = await startProject(db, {
    id: project.id,
    repoDir: project.repoDir,
    devPort: project.devPort,
    prodPort: project.prodPort,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    status: result.status,
    url: result.url,
    pid: result.pid,
    port: result.port,
  });
}
