import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { deleteRelation } from '@/db/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { sqlite } = getDb();
  const { id } = await params;
  const ok = deleteRelation(sqlite, id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
