import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDb } from '@/db/client';
import { getCard, moveCard, updateCard, checkDepGate } from '@/db/cards';
import { getProject } from '@/db/projects';
import { checkGate, type State } from '@/worker/gates';
import { broadcast } from '@/lib/ws-store';
import { moveSchema } from './schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// REPO_DIR must be set in the launchd plist environment.
// Fallback: derive from DB_PATH which is always set correctly.
function getRepoDir(): string {
  if (process.env.REPO_DIR) return process.env.REPO_DIR;
  // DB_PATH is e.g. /Users/foo/am/board/board.db — repo is two levels up
  const dbPath = process.env.DB_PATH ?? '';
  if (dbPath && dbPath.endsWith('/board.db')) return path.dirname(path.dirname(dbPath));
  return '/Users/michaeloneal/am';
}

// ── Ship queue — serialize all ship-hooks so they never dogpile ──────────────
// At most one ship-hook runs at a time. Subsequent ships queue here and drain
// one-by-one. In-memory: survives within a process lifetime, cleared on restart.
const shipQueue: Array<{ workDir: string; title: string; version: string | null; repoDir: string | null }> = [];
let shipInFlight = false;
let shipInFlightWorkDir: string | null = null;

function drainShipQueue() {
  if (shipInFlight || shipQueue.length === 0) return;
  const next = shipQueue.shift()!;
  shipInFlight = true;
  shipInFlightWorkDir = next.workDir;

  const REPO = getRepoDir();
  const slug = next.workDir.split('/').pop() ?? 'unknown';
  const msg = `${slug}: ${next.title}`;
  const script = path.join(REPO, 'bin', 'ship-hook');
  const baseArgs = next.version ? [next.workDir, slug, msg, next.version] : [next.workDir, slug, msg];
  const args = next.repoDir ? [...baseArgs, next.repoDir] : baseArgs;

  const ts = new Date().toISOString();
  const spawnLog = '/tmp/board-deploy-spawns.log';
  const { appendFileSync } = require('node:fs') as typeof import('node:fs');
  try { appendFileSync(spawnLog, `[${ts}] ship-hook start (queued): slug=${slug} queue_remaining=${shipQueue.length}\n`); } catch {}

  const child = spawn(script, args, { stdio: 'ignore' });
  child.on('close', (code) => {
    try { appendFileSync(spawnLog, `[${new Date().toISOString()}] ship-hook done: slug=${slug} exit=${code} queue_remaining=${shipQueue.length}\n`); } catch {}
    shipInFlight = false;
    shipInFlightWorkDir = null;
    drainShipQueue();
  });
}

function spawnShipHook(workDir: string, cardTitle: string, cardVersion: string | null, repoDir: string | null = null) {
  const slug = workDir.split('/').pop() ?? 'unknown';
  const ts = new Date().toISOString();
  const spawnLog = '/tmp/board-deploy-spawns.log';
  const { appendFileSync } = require('node:fs') as typeof import('node:fs');

  // Deduplicate: skip if this workDir is already running or queued
  const alreadyQueued = shipInFlightWorkDir === workDir || shipQueue.some(q => q.workDir === workDir);
  if (alreadyQueued) {
    try { appendFileSync(spawnLog, `[${ts}] ship-hook SKIPPED (already queued): slug=${slug}\n`); } catch {}
    return;
  }

  try { appendFileSync(spawnLog, `[${ts}] ship-hook enqueued: slug=${slug} version=${cardVersion ?? 'none'} repoDir=${repoDir ?? 'none'} in_flight=${shipInFlight} queue_len=${shipQueue.length}\n`); } catch {}
  shipQueue.push({ workDir, title: cardTitle, version: cardVersion, repoDir });
  drainShipQueue();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const body = await req.json();
  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  // Dep gate: block transition if any dep is not shipped
  const depFailures = checkDepGate(db, id);
  if (depFailures.length > 0) {
    return NextResponse.json({ error: 'gate failed', failures: depFailures }, { status: 422 });
  }

  const gateCard = {
    ...card,
    attachments: card.attachments.map(a => {
      if (a.fsPath) return a.fsPath;
      if (a.path.startsWith('/uploads/')) return path.join(process.cwd(), 'public', a.path);
      return a.path;
    }),
  };
  const gate = await checkGate(card.state as State, parsed.data.state as State, gateCard, card.workDir ?? '');
  if (!gate.allowed) return NextResponse.json({ error: 'gate failed', failures: gate.failures }, { status: 422 });
  let updated = moveCard(db, id, parsed.data.state) ?? null;
  if (parsed.data.note && updated) {
    updated = updateCard(db, id, {
      workLogEntry: { timestamp: new Date().toISOString(), message: parsed.data.note },
    }) ?? null;
  }
  try { broadcast({ type: 'card_moved', card: updated }); } catch {}

  // Post-ship hook — all cards with a workDir (AM and external projects)
  if (parsed.data.state === 'shipped' && card.workDir) {
    // For external projects, pass repoDir so ship-hook can push to the project repo
    let repoDir: string | null = null;
    if (card.projectId) {
      const proj = getProject(db, card.projectId);
      if (proj?.repoDir) repoDir = proj.repoDir;
    }
    spawnShipHook(card.workDir, card.title, card.version ?? null, repoDir);
  }

  return NextResponse.json(updated);
}
