import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCard, resetCard } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const existing = getCard(db, id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const updated = resetCard(db, id);
  try { broadcast({ type: 'card_updated', card: updated }); } catch {}
  return NextResponse.json(updated);
}
