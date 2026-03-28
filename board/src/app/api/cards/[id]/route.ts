import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCard, updateCard } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';
import { patchSchema } from './schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  return NextResponse.json(card);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const card = updateCard(db, id, parsed.data);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  try { broadcast({ type: 'card_updated', card }); } catch {}
  return NextResponse.json(card);
}
