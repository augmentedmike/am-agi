import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { storeKnowledge } from '@/db/knowledge';
import { storeSchema } from './schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = storeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const id = storeKnowledge(db, sqlite, parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
