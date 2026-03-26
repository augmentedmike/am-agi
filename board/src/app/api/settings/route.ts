import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getAllSettings, setSetting } from '@/db/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const all = getAllSettings(db);
  // Mask token in response — send a boolean instead of the value
  const safe = { ...all, github_token: all.github_token ? '***' : '' };
  return NextResponse.json(safe);
}

export async function PATCH(req: NextRequest) {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const body = await req.json() as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') setSetting(db, key, value);
  }
  const all = getAllSettings(db);
  const safe = { ...all, github_token: all.github_token ? '***' : '' };
  return NextResponse.json(safe);
}
