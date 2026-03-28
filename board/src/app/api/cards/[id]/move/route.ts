import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCard, moveCard, updateCard } from '@/db/cards';
import { checkGate, type State } from '@/worker/gates';
import { broadcast } from '@/lib/ws-store';
import { moveSchema } from './schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  const gateCard = { ...card, attachments: card.attachments.map(a => a.path) };
  const gate = await checkGate(card.state as State, parsed.data.state as State, gateCard, card.workDir ?? '');
  if (!gate.allowed) return NextResponse.json({ error: 'gate failed', failures: gate.failures }, { status: 422 });
  let updated = moveCard(db, id, parsed.data.state) ?? null;
  if (parsed.data.note && updated) {
    updated = updateCard(db, id, {
      workLogEntry: { timestamp: new Date().toISOString(), message: parsed.data.note },
    }) ?? null;
  }
  try { broadcast({ type: 'card_moved', card: updated }); } catch {}
  return NextResponse.json(updated);
}
