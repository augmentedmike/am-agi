import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { listCards, createCard } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';
import { listSchema, createSchema } from './schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notifyClients(event: unknown) {
  try { broadcast(event); } catch {}
}

export async function GET(req: NextRequest) {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = listSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const result = listCards(db, parsed.data);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const card = createCard(db, parsed.data);
  notifyClients({ type: 'card_created', card });
  return NextResponse.json(card, { status: 201 });
}
