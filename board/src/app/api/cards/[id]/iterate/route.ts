import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCard } from '@/db/cards';
import { runIteration } from '@am/agent/src/adapters/nextjs-loop';
import { AuthError } from '@am/agent/src/adapters/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const card = getCard(db, id);

  if (!card || !card.workDir) {
    return NextResponse.json({ error: 'card not found or has no workDir' }, { status: 404 });
  }

  try {
    const result = await runIteration(card.workDir);
    return NextResponse.json({
      result: result.result,
      exitCode: result.exitCode,
      usage: result.usage,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'auth_expired' }, { status: 401 });
    }
    throw err;
  }
}
