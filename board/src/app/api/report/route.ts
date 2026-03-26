import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { listCards } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);

  const sinceParam = req.nextUrl.searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();
  const sinceIso = since.toISOString();

  const allCards = listCards(db);

  const shipped = allCards
    .filter(c => c.shippedAt && c.shippedAt >= sinceIso)
    .map(c => ({ id: c.id, title: c.title, shippedAt: c.shippedAt }));

  const updated = allCards
    .filter(c => c.state !== 'shipped' && c.updatedAt >= sinceIso)
    .map(c => {
      const logs = c.workLog ?? [];
      const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
      return { id: c.id, title: c.title, state: c.state, priority: c.priority, lastLog };
    });

  const inProgress = allCards
    .filter(c => c.state === 'in-progress')
    .map(c => ({ id: c.id, title: c.title, priority: c.priority }));

  return NextResponse.json({
    date: now.toISOString().slice(0, 10),
    period: { from: sinceIso, to: now.toISOString() },
    shipped,
    updated,
    inProgress,
    stats: {
      shipped: shipped.length,
      updated: updated.length,
      inProgress: inProgress.length,
    },
  });
}
