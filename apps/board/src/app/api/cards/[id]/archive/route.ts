import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getCard, archiveCard } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const updated = archiveCard(db, id);
  return NextResponse.json(updated);
}
