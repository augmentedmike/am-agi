import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import { getDb } from '@/db/client';
import { getCard } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  if (!card.workDir) return NextResponse.json({ error: 'no workDir' }, { status: 400 });

  const workDir = card.workDir.replace(/^~/, process.env.HOME ?? '');
  if (!fs.existsSync(workDir)) return NextResponse.json({ error: 'workDir not found' }, { status: 404 });

  // Check it's actually a git repo
  if (!fs.existsSync(`${workDir}/.git`)) {
    return NextResponse.json({ error: 'not a git repository' }, { status: 422 });
  }

  // Detect current branch first so we can scope commits correctly
  let branch = '';
  try {
    branch = execSync('git branch --show-current', { cwd: workDir, encoding: 'utf8', timeout: 2000 }).trim();
  } catch { /* detached HEAD or no branch */ }

  // Feature branches: exclude dev so only card-specific commits appear
  // dev branch (or unknown): exclude main to show unreleased commits
  const isFeatureBranch = branch !== '' && branch !== 'dev' && branch !== 'main';

  const fmt = '--format="%H\x1f%s\x1f%an\x1f%ar\x1f%ai\x1e"';

  let raw = '';
  if (isFeatureBranch) {
    // Try most specific exclusion first, fall back gracefully if refs missing
    try {
      raw = execSync(`git log HEAD ^dev ^origin/dev ${fmt}`, { cwd: workDir, encoding: 'utf8', timeout: 8000 });
    } catch {
      try {
        raw = execSync(`git log HEAD ^dev ${fmt}`, { cwd: workDir, encoding: 'utf8', timeout: 8000 });
      } catch {
        raw = execSync(`git log HEAD ^main ^origin/main ${fmt}`, { cwd: workDir, encoding: 'utf8', timeout: 8000 });
      }
    }
  } else {
    try {
      raw = execSync(`git log HEAD ^main ^origin/main ${fmt}`, { cwd: workDir, encoding: 'utf8', timeout: 8000 });
    } catch {
      return NextResponse.json({ error: 'git error' }, { status: 500 });
    }
  }

  const commits = raw
    .split('\x1e')
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => {
      const [sha, subject, author, ago, date] = r.split('\x1f');
      return { sha: sha?.trim(), subject: subject?.trim(), author: author?.trim(), ago: ago?.trim(), date: date?.trim() };
    })
    .filter(c => c.sha);

  return NextResponse.json({ commits, branch, workDir });
}
