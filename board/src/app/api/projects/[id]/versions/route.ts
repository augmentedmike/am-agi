import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function semverSort(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [a0, a1, a2] = parse(a);
  const [b0, b1, b2] = parse(b);
  return a0 !== b0 ? a0 - b0 : a1 !== b1 ? a1 - b1 : a2 - b2;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Get distinct versions from cards for this project
  const rows = sqlite.prepare(
    `SELECT DISTINCT version FROM cards WHERE project_id = ? AND version IS NOT NULL AND version != '' AND archived = 0`
  ).all(id) as { version: string }[];

  const versionSet = new Set(rows.map(r => r.version));
  if (project.currentVersion) versionSet.add(project.currentVersion);

  const versions = Array.from(versionSet).sort(semverSort);
  return NextResponse.json({ versions, currentVersion: project.currentVersion ?? null });
}
