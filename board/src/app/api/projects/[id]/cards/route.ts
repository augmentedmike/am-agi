import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';
import { listCards } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const cards = listCards(db, { projectId: id });
  return NextResponse.json(cards);
}
