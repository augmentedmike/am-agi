import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { getCard, updateCard, moveCard } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const steerSchema = z.object({
  action: z.enum(['approve', 'escalate', 'guidance', 'feedback']),
  message: z.string().optional(),
});

type SteerAction = z.infer<typeof steerSchema>['action'];

const ACTION_PREFIX: Record<SteerAction, string> = {
  approve: '[APPROVED]',
  escalate: '[ESCALATION]',
  guidance: '[GUIDANCE]',
  feedback: '[FEEDBACK]',
};

function appendUserNotes(workDir: string, text: string): void {
  const notesFile = join(workDir, 'user-notes.md');
  const current = existsSync(notesFile) ? readFileSync(notesFile, 'utf8') : '# User Notes\n';
  const entry = `\n---\n[${new Date().toISOString()}] ${text}\n`;
  try { writeFileSync(notesFile, current + entry, 'utf8'); } catch { /* best-effort */ }
}

async function killAgent(id: string, req: NextRequest): Promise<void> {
  try {
    const url = new URL(`/api/cards/${id}/kill-agent`, req.url);
    await fetch(url.toString(), { method: 'POST' });
  } catch { /* best-effort */ }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();

  const body = await req.json();
  const parsed = steerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  const { action, message } = parsed.data;
  const timestamp = new Date().toISOString();
  const prefix = ACTION_PREFIX[action];
  const logMessage = message?.trim() ? `${prefix} ${message.trim()}` : prefix;

  // Write workLog entry for all actions
  let updated = updateCard(db, id, {
    workLogEntry: { timestamp, message: logMessage },
  });
  if (!updated) return NextResponse.json({ error: 'update failed' }, { status: 500 });

  // Action-specific side-effects
  if (action === 'escalate') {
    // Kill the agent
    await killAgent(id, req);

    // Move card back to in-progress (bypass gate — escalation is a forced override)
    const moved = moveCard(db, id, 'in-progress');
    if (moved) {
      updated = moved;
      try { broadcast({ type: 'card_moved', card: moved }); } catch {}
    }
  } else if (action === 'guidance' && message?.trim() && card.workDir) {
    // Also write to user-notes.md so the agent sees it next iteration
    const workDir = card.workDir.replace(/^~/, process.env.HOME ?? '');
    appendUserNotes(workDir, message.trim());
  }

  try { broadcast({ type: 'card_updated', card: updated }); } catch {}

  return NextResponse.json(updated);
}
