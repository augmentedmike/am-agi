import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCard } from '@/db/cards';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// REPO_ROOT is two levels above board/ (board/src/app/api/..)
const REPO_ROOT = resolve(process.cwd(), '..');
const DISPATCHER = resolve(REPO_ROOT, 'bin/dispatcher');

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const card = getCard(db, id);

  if (!card || !card.workDir) {
    return NextResponse.json({ error: 'card not found or has no workDir' }, { status: 404 });
  }

  // Run one iteration via the dispatcher's agent loop as a subprocess.
  // Turbopack cannot bundle cross-directory imports (../agent/), so we spawn
  // the agent process the same way the dispatcher does — no static import needed.
  const result = spawnSync(
    'bun',
    ['run', resolve(REPO_ROOT, 'agent/src/loop/index.ts'), '--once', id],
    { cwd: card.workDir, encoding: 'utf8', timeout: 600_000 }
  );

  if (result.stderr?.includes('Not logged in') || result.stderr?.includes('Invalid authentication')) {
    return NextResponse.json({ error: 'auth_expired' }, { status: 401 });
  }

  return NextResponse.json({
    result: result.stdout ?? '',
    exitCode: result.status ?? -1,
  });
}
