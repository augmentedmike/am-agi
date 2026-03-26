import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getCard } from '@/db/cards';

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
  if (depth > 5 || counter.n > 600) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs: FileNode[] = [];
  const files: FileNode[] = [];

  for (const entry of entries) {
    if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue;
    if (counter.n++ > 600) break;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push({
        name: entry.name,
        path: fullPath,
        type: 'dir',
        children: buildTree(fullPath, depth + 1, counter),
      });
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  if (!card.workDir) return NextResponse.json({ error: 'no workDir' }, { status: 400 });

  const workDir = card.workDir.replace(/^~/, process.env.HOME ?? '');
  if (!fs.existsSync(workDir)) return NextResponse.json({ error: 'workDir not found' }, { status: 404 });

  const tree = buildTree(workDir);
  return NextResponse.json({ tree, workDir });
}
