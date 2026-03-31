import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import { getDb } from '@/db/client';
import { getCard } from '@/db/cards';
import { getProject } from '@/db/projects';
import { AM_BOARD_PROJECT_ID } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function run(cmd: string, cwd: string, timeout = 8000): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', timeout }).trim();
  } catch { return ''; }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  const projectId = card.projectId ?? AM_BOARD_PROJECT_ID;
  const project = getProject(db, projectId);

  // Resolve a path to search: prefer project repoDir if it exists, fall back to card workDir
  const candidates = [project?.repoDir, card.workDir].filter(Boolean) as string[];
  const rawPath = candidates.find(p => fs.existsSync(p.replace(/^~/, process.env.HOME ?? '')));
  if (!rawPath) return NextResponse.json({ error: 'directory not found' }, { status: 404 });

  const resolved = rawPath.replace(/^~/, process.env.HOME ?? '');

  // Walk up to git root if needed (handles repoDir pointing to a subdirectory)
  let gitRoot = resolved;
  if (!fs.existsSync(`${resolved}/.git`)) {
    gitRoot = run('git rev-parse --show-toplevel', resolved);
    if (!gitRoot || !fs.existsSync(`${gitRoot}/.git`)) {
      return NextResponse.json({ error: 'not a git repository' }, { status: 422 });
    }
  }

  const branch = run('git branch --show-current', gitRoot);

  // Filter commits: iteration commits match "<cardId>/iter-*", squash commit matches "<cardId>: *"
  const fmt = '--format="%H\x1f%s\x1f%an\x1f%ar\x1f%ai\x1e"';
  const raw = run(`git log --all --grep="^${id}" ${fmt}`, gitRoot, 10000);

  const commits = raw
    .split('\x1e')
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => {
      const [sha, subject, author, ago, date] = r.split('\x1f');
      return { sha: sha?.trim(), subject: subject?.trim(), author: author?.trim(), ago: ago?.trim(), date: date?.trim() };
    })
    .filter(c => c.sha);

  return NextResponse.json({ commits, branch, repoDir: gitRoot });
}
