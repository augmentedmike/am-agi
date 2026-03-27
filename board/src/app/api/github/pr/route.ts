import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getCard } from '@/db/cards';
import { getSetting } from '@/db/settings';
import { getPR, prStatus, prNumberFromUrl, repoFromPrUrl } from '@/lib/github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/github/pr?cardId=<id>
 * Returns PR status for the card's stored prUrl.
 */
export async function GET(req: NextRequest) {
  const cardId = req.nextUrl.searchParams.get('cardId');
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);

  const card = getCard(db, cardId);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  if (!card.prUrl) return NextResponse.json({ status: 'none', prUrl: null });

  const token = getSetting(db, 'github_token');
  if (!token) return NextResponse.json({ error: 'github_token not configured' }, { status: 503 });

  const prNumber = prNumberFromUrl(card.prUrl);
  const ownerRepo = repoFromPrUrl(card.prUrl);
  if (!prNumber || !ownerRepo) {
    return NextResponse.json({ error: 'invalid prUrl format' }, { status: 400 });
  }

  try {
    const pr = await getPR(token, ownerRepo, prNumber);
    return NextResponse.json({ status: prStatus(pr), prUrl: card.prUrl, prNumber, title: pr.title });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
