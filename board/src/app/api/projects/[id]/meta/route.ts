import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';
import { getSetting, setSetting } from '@/db/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ProjectMeta = {
  website: string;
  youtube: string;
  twitter: string;
  instagram: string;
  tiktok: string;
  linkedin: string;
  targetAudience: string;
  cadence: string;
  niche: string;
};

const EMPTY: ProjectMeta = {
  website: '',
  youtube: '',
  twitter: '',
  instagram: '',
  tiktok: '',
  linkedin: '',
  targetAudience: '',
  cadence: '',
  niche: '',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const raw = getSetting(db, `project_meta_${id}` as never);
  if (!raw) return NextResponse.json(EMPTY);
  try {
    return NextResponse.json({ ...EMPTY, ...JSON.parse(raw) });
  } catch {
    return NextResponse.json(EMPTY);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json() as Partial<ProjectMeta>;
  const raw = getSetting(db, `project_meta_${id}` as never);
  const existing = raw ? JSON.parse(raw) : {};
  const updated = { ...existing, ...body };
  setSetting(db, `project_meta_${id}`, JSON.stringify(updated));
  return NextResponse.json(updated);
}
