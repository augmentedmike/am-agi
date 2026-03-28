import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCardIterations } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const iters = getCardIterations(db, id);
  return NextResponse.json(iters);
}
