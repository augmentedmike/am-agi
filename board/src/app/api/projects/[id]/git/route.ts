import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function run(cmd: string, cwd: string, timeout = 5000): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', timeout }).trim();
  } catch {
    return '';
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const repoDir = (project.repoDir ?? '').replace(/^~/, process.env.HOME ?? '');
  if (!repoDir || !fs.existsSync(repoDir)) {
    return NextResponse.json({ error: 'directory not found' }, { status: 404 });
  }
  if (!fs.existsSync(`${repoDir}/.git`)) {
    return NextResponse.json({ error: 'not a git repository' }, { status: 422 });
  }

  const branch = run('git branch --show-current', repoDir);
  const statusRaw = run('git status --porcelain', repoDir);
  const statusLines = statusRaw ? statusRaw.split('\n').filter(Boolean).map(l => ({
    xy: l.slice(0, 2),
    file: l.slice(3),
  })) : [];

  const logFmt = '--format="%H\x1f%s\x1f%an\x1f%ar\x1f%ai\x1e"';
  const logRaw = run(`git log -60 ${logFmt}`, repoDir, 8000);
  const commits = logRaw
    .split('\x1e')
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => {
      const [sha, subject, author, ago, date] = r.split('\x1f');
      return { sha: sha?.trim(), subject: subject?.trim(), author: author?.trim(), ago: ago?.trim(), date: date?.trim() };
    })
    .filter(c => c.sha);

  // Branches
  const branchesRaw = run('git branch -a --format="%(refname:short)"', repoDir);
  const branches = branchesRaw ? branchesRaw.split('\n').filter(Boolean) : [];

  return NextResponse.json({ branch, status: statusLines, commits, branches, repoDir });
}

// GET diff for a specific commit or file
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const repoDir = (project.repoDir ?? '').replace(/^~/, process.env.HOME ?? '');
  if (!repoDir || !fs.existsSync(`${repoDir}/.git`)) {
    return NextResponse.json({ error: 'not a git repository' }, { status: 422 });
  }

  const body = await req.json();
  const { sha, file } = body;

  let diff = '';
  if (sha) {
    diff = run(`git show --stat -p ${sha}`, repoDir, 10000);
  } else if (file) {
    diff = run(`git diff HEAD -- "${file}"`, repoDir, 10000);
  }

  return NextResponse.json({ diff });
}
