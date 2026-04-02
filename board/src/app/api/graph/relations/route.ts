import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { createRelation, getEntityById } from '@/db/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { sqlite } = getDb();
  const body = await req.json();
  const { from_id, to_id, relation, weight, properties, source } = body;
  if (!from_id || !to_id || !relation) {
    return NextResponse.json({ error: 'from_id, to_id, and relation are required' }, { status: 400 });
  }
  if (!getEntityById(sqlite, from_id)) {
    return NextResponse.json({ error: `Entity ${from_id} not found` }, { status: 404 });
  }
  if (!getEntityById(sqlite, to_id)) {
    return NextResponse.json({ error: `Entity ${to_id} not found` }, { status: 404 });
  }
  const rel = createRelation(sqlite, { fromId: from_id, toId: to_id, relation, weight, properties, source });
  return NextResponse.json(rel, { status: 201 });
}
