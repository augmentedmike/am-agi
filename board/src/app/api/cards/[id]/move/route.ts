import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import { getDb } from '@/db/client';
import { getCard, moveCard, updateCard } from '@/db/cards';
import { checkGate, type State } from '@/worker/gates';
import { broadcast } from '@/lib/ws-store';
import { moveSchema } from './schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Post-ship hook for AM Board cards (no projectId).
 * squash → merge dev → push → set version from card → tag → board-deploy
 */
function runAmBoardShipHook(cardId: string, workDir: string, cardTitle: string, cardVersion: string | null) {
  const REPO = process.env.REPO_DIR ?? '/Users/michaeloneal/am';
  const slug = workDir.split('/').pop() ?? cardId.slice(0, 8);
  const msg = `${slug}: ${cardTitle}`;

  try {
    // Squash iteration commits
    const mergeBase = execSync(`git merge-base HEAD origin/dev`, { cwd: workDir }).toString().trim();
    execSync(`git reset ${mergeBase}`, { cwd: workDir });
    execSync(`git add -A -- ':!research.md' ':!criteria.md' ':!todo.md' ':!work.md' ':!iter/' ':!apps/' ':!.next/'`, { cwd: workDir });
    const status = execSync(`git status --porcelain`, { cwd: workDir }).toString().trim();
    if (status) {
      execSync(`git commit -m ${JSON.stringify(msg)}`, { cwd: workDir });
    }

    // Merge into dev
    execSync(`git fetch origin`, { cwd: workDir });
    execSync(`git rebase origin/dev`, { cwd: workDir });
    execSync(`git checkout dev`, { cwd: REPO });
    execSync(`git merge --ff-only ${slug}`, { cwd: REPO });

    // Set version from card, tag, push
    if (cardVersion) {
      const v = cardVersion.replace(/^v/, '');
      const pkgPath = `${REPO}/board/package.json`;
      execSync(`node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('${pkgPath}'));p.version='${v}';fs.writeFileSync('${pkgPath}',JSON.stringify(p,null,2)+'\\n')"`, { cwd: REPO });
      execSync(`git add ${pkgPath}`, { cwd: REPO });
      execSync(`git commit -m "bump: v${v}"`, { cwd: REPO });
      execSync(`git tag v${v}`, { cwd: REPO });
    }

    execSync(`git push origin dev`, { cwd: REPO });
    if (cardVersion) {
      const v = cardVersion.replace(/^v/, '');
      execSync(`git push origin v${v}`, { cwd: REPO });
    }

    // Deploy to prod
    execSync(`${REPO}/bin/board-deploy`, { cwd: REPO });

  } catch (err) {
    console.error('[ship-hook] failed:', err);
  }
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
    setImmediate(() => runAmBoardShipHook(id, card.workDir!, card.title, card.version ?? null));
  }

  return NextResponse.json(updated);
}
