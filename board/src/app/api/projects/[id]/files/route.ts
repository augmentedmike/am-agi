import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
};

const IGNORE = new Set([
  '.git', 'node_modules', '.next', '__pycache__', '.DS_Store',
  'dist', 'build', '.turbo', '.vercel', 'coverage', '.nyc_output',
]);

function buildTree(dir: string, depth = 0, counter = { n: 0 }): FileNode[] {
  if (depth > 6 || counter.n > 800) return [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }

  const dirs: FileNode[] = [];
  const files: FileNode[] = [];

  for (const entry of entries) {
    if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue;
    if (counter.n++ > 800) break;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push({ name: entry.name, path: fullPath, type: 'dir', children: buildTree(fullPath, depth + 1, counter) });
    } else {
      let size: number | undefined;
      try { size = fs.statSync(fullPath).size; } catch { /* ignore */ }
      files.push({ name: entry.name, path: fullPath, type: 'file', size });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filePath = req.nextUrl.searchParams.get('file');

  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const repoDir = (project.repoDir ?? '').replace(/^~/, process.env.HOME ?? '');
  if (!repoDir || !fs.existsSync(repoDir)) {
    return NextResponse.json({ error: 'project directory not found' }, { status: 404 });
  }

  // File content request
  if (filePath) {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(repoDir)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    try {
      const stat = fs.statSync(resolved);
      if (stat.size > 500_000) return NextResponse.json({ error: 'file too large' }, { status: 413 });
      const content = fs.readFileSync(resolved, 'utf8');
      return NextResponse.json({ content, path: resolved });
    } catch {
      return NextResponse.json({ error: 'cannot read file' }, { status: 400 });
    }
  }

  const tree = buildTree(repoDir);
  return NextResponse.json({ tree, rootDir: repoDir });
}
