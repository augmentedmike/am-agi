import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getDb } from '@/db/client';
import { getCard } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  // No workDir — no agent could be running
  if (!card.workDir) {
    return NextResponse.json({ killed: false });
  }

  const workDir = card.workDir.replace(/^~/, process.env.HOME ?? '');
  const pidFilePath = join(workDir, '.agent-pid');

  if (!existsSync(pidFilePath)) {
    return NextResponse.json({ killed: false });
  }

  let pid: number;
  try {
    pid = parseInt(readFileSync(pidFilePath, 'utf8').trim(), 10);
    if (isNaN(pid)) throw new Error('invalid pid');
  } catch {
    // Corrupt pid file — clean it up
    try { unlinkSync(pidFilePath); } catch { /* ignore */ }
    return NextResponse.json({ killed: false });
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Process already gone — clean up stale file
    try { unlinkSync(pidFilePath); } catch { /* ignore */ }
    return NextResponse.json({ killed: false });
  }

  try { unlinkSync(pidFilePath); } catch { /* ignore */ }

  return NextResponse.json({ killed: true, pid });
}
