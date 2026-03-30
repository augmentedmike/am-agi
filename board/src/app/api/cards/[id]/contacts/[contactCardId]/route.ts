import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCard, unlinkContactFromCard } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; contactCardId: string }> }) {
  const { id, contactCardId } = await params;
  const { db } = getDb();

  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  const removed = unlinkContactFromCard(db, id, contactCardId);
  if (!removed) return NextResponse.json({ error: 'link not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
