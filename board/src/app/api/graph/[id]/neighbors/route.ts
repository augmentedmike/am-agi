import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getEntityById, getNeighbors } from '@/db/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { sqlite } = getDb();
  const { id } = await params;
  const entity = getEntityById(sqlite, id);
  if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const neighbors = getNeighbors(sqlite, id);
  return NextResponse.json(neighbors);
}
