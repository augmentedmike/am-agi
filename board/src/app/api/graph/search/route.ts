import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { searchEntities } from '@/db/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { sqlite } = getDb();
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const type = req.nextUrl.searchParams.get('type') ?? undefined;
  if (!q) return NextResponse.json([]);
  const results = searchEntities(sqlite, q, type);
  return NextResponse.json(results);
}
