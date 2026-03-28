import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { searchKnowledge } from '@/db/knowledge';
import { searchSchema } from './schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { db, sqlite } = getDb();
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = searchSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Parse embedding from query param if provided, else use zero vector
  let queryEmbedding: number[] = [];
  if (parsed.data.embedding) {
    try { queryEmbedding = JSON.parse(parsed.data.embedding); } catch {}
  }

  const results = searchKnowledge(db, queryEmbedding, parsed.data.limit ?? 10);
  return NextResponse.json(results);
}
