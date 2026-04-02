import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { searchEntities, createEntity } from '@/db/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { sqlite } = getDb();
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const type = req.nextUrl.searchParams.get('type') ?? undefined;
  if (!q) return NextResponse.json([]);
  const results = searchEntities(sqlite, q, type);
  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const { sqlite } = getDb();
  const body = await req.json();
  const { type, name, summary, aliases, properties, confidence, source } = body;
  if (!type || !name) {
    return NextResponse.json({ error: 'type and name are required' }, { status: 400 });
  }
  const entity = createEntity(sqlite, { type, name, summary, aliases, properties, confidence, source });
  return NextResponse.json(entity, { status: 201 });
}
