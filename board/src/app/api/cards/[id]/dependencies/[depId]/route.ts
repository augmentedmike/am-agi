import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCard, removeDependency, getDependencies } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; depId: string }> }) {
  const { id, depId } = await params;
  const { db } = getDb();

  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  const depsBefore = getDependencies(db, id);
  const exists = depsBefore.some(d => d.id === depId);
  if (!exists) return NextResponse.json({ error: 'dependency not found' }, { status: 404 });

  removeDependency(db, id, depId);
  const dependencies = getDependencies(db, id);
  try { broadcast({ type: 'card_updated', card: { ...card, dependencies } }); } catch {}
  return NextResponse.json({ ok: true });
}
