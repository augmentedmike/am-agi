import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDb } from '@/db/client';
import { getCard, moveCard, updateCard } from '@/db/cards';
import { checkGate, type State } from '@/worker/gates';
import { broadcast } from '@/lib/ws-store';
import { moveSchema } from './schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// REPO_DIR must be set in the launchd plist environment.
// Fallback: derive from DB_PATH which is always set correctly.
function getRepoDir(): string {
  if (process.env.REPO_DIR) return process.env.REPO_DIR;
  // DB_PATH is e.g. /Users/foo/am/board.db — repo is one level up
  const dbPath = process.env.DB_PATH ?? '';
  if (dbPath && dbPath.endsWith('/board.db')) return path.dirname(dbPath);
  return '/Users/michaeloneal/am';
}

function spawnShipHook(workDir: string, cardTitle: string, cardVersion: string | null) {
  const REPO = getRepoDir();
  const slug = workDir.split('/').pop() ?? 'unknown';
  const msg = `${slug}: ${cardTitle}`;
  const script = path.join(REPO, 'bin', 'ship-hook');
  const args = cardVersion ? [workDir, slug, msg, cardVersion] : [workDir, slug, msg];
  const child = spawn(script, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const body = await req.json();
  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  const gateCard = { ...card, attachments: card.attachments.map(a => a.path) };
  const gate = await checkGate(card.state as State, parsed.data.state as State, gateCard, card.workDir ?? '');
  if (!gate.allowed) return NextResponse.json({ error: 'gate failed', failures: gate.failures }, { status: 422 });
  let updated = moveCard(db, id, parsed.data.state) ?? null;
  if (parsed.data.note && updated) {
    updated = updateCard(db, id, {
      workLogEntry: { timestamp: new Date().toISOString(), message: parsed.data.note },
    }) ?? null;
  }
  try { broadcast({ type: 'card_moved', card: updated }); } catch {}

  // Post-ship hook — AM Board cards only (no projectId)
  if (parsed.data.state === 'shipped' && card.workDir && !card.projectId) {
    spawnShipHook(card.workDir, card.title, card.version ?? null);
  }

  return NextResponse.json(updated);
}
