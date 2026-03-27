import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getCard } from '@/db/cards';
import { getSetting } from '@/db/settings';
import { mergePR, prNumberFromUrl, repoFromPrUrl } from '@/lib/github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/github/pr/merge
 * Body: { cardId: string }
 * Merges the PR stored on the card.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { cardId } = body as { cardId?: string };
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);

  const card = getCard(db, cardId);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  if (!card.prUrl) return NextResponse.json({ error: 'card has no PR' }, { status: 400 });

  const token = getSetting(db, 'github_token');
  if (!token) return NextResponse.json({ error: 'github_token not configured' }, { status: 503 });

  const prNumber = prNumberFromUrl(card.prUrl);
  const ownerRepo = repoFromPrUrl(card.prUrl);
  if (!prNumber || !ownerRepo) {
    return NextResponse.json({ error: 'invalid prUrl format' }, { status: 400 });
  }

  try {
    await mergePR(token, ownerRepo, prNumber);
    return NextResponse.json({ merged: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
