import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCard, addDependency, getDependencies } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const body = await req.json().catch(() => ({}));
  const { dependsOnId } = body as { dependsOnId?: string };

  if (!dependsOnId) return NextResponse.json({ error: 'dependsOnId is required' }, { status: 400 });
  if (dependsOnId === id) return NextResponse.json({ error: 'a card cannot depend on itself' }, { status: 400 });

  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  const depCard = getCard(db, dependsOnId);
  if (!depCard) return NextResponse.json({ error: 'dependency card not found' }, { status: 404 });

  try {
    addDependency(db, id, dependsOnId);
  } catch {
    // Duplicate — already exists, that's fine
  }

  const dependencies = getDependencies(db, id);
  try { broadcast({ type: 'card_updated', card: { ...card, dependencies } }); } catch {}
  return NextResponse.json(dependencies);
}
