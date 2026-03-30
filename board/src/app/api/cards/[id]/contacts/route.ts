import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCard, linkContactToCard, listCardContacts } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  return NextResponse.json(listCardContacts(db, id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { contactCardId } = body as { contactCardId?: string };
  if (!contactCardId) return NextResponse.json({ error: 'contactCardId is required' }, { status: 400 });

  const contactCard = getCard(db, contactCardId);
  if (!contactCard) return NextResponse.json({ error: 'contact card not found' }, { status: 404 });

  try {
    linkContactToCard(db, id, contactCardId);
  } catch {
    return NextResponse.json({ error: 'already linked' }, { status: 409 });
  }

  return NextResponse.json(listCardContacts(db, id), { status: 201 });
}
