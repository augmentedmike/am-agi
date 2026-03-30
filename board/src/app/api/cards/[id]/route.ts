import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getDb } from '@/db/client';
import { getCard, updateCard, getDependencies } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';
import { evaluateRules } from '@/lib/automation-engine';
import { patchSchema } from './schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  const dependencies = getDependencies(db, id);
  return NextResponse.json({ ...card, dependencies });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const previousCard = getCard(db, id);
  const previousState = previousCard?.state;
  const card = updateCard(db, id, parsed.data);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  try { broadcast({ type: 'card_updated', card }); } catch {}

  // Fire automation rules when state changes
  if (parsed.data.state && parsed.data.state !== previousState) {
    evaluateRules(db, {
      type: 'card_state_change',
      card: {
        id: card.id,
        title: card.title,
        state: card.state,
        priority: card.priority,
        project_id: card.projectId,
      },
      fromState: previousState ?? '',
      toState: card.state,
    }).catch(err => console.error('[automation] card_state_change eval failed:', err));
  }

  // If a work log note was added and the card has an active worktree, write it
  // to user-notes.md so the agent sees it on the next iteration.
  if (parsed.data.workLogEntry && card.workDir) {
    try {
      const workDir = card.workDir.replace(/^~/, process.env.HOME ?? '');
      if (!existsSync(workDir)) return;
      mkdirSync(workDir, { recursive: true });
      const notesPath = join(workDir, 'user-notes.md');
      const { timestamp, message } = parsed.data.workLogEntry;
      appendFileSync(notesPath, `\n## Note from user — ${timestamp}\n\n${message}\n`);
    } catch { /* worktree may not exist yet — best effort */ }
  }

  return NextResponse.json(card);
}
