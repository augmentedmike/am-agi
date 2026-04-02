import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getEntityById, updateEntity, deleteEntity } from '@/db/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { sqlite } = getDb();
  const { id } = await params;
  const entity = getEntityById(sqlite, id);
  if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(entity);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { sqlite } = getDb();
  const { id } = await params;
  const body = await req.json();
  const updated = updateEntity(sqlite, id, body);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { sqlite } = getDb();
  const { id } = await params;
  const ok = deleteEntity(sqlite, id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
