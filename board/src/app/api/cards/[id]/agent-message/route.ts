import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getCard } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function encodeProjectPath(absPath: string): string {
  return absPath.replace(/\//g, '-');
}

function latestJsonl(dir: string): string | null {
  let entries: string[];
  try {
    entries = readdirSync(dir, { encoding: 'utf8' }) as string[];
  } catch {
    return null;
  }
  const jsonlFiles = entries
    .filter((e) => e.endsWith('.jsonl'))
    .map((name) => {
      const fullPath = join(dir, name);
      try {
        const mtime = statSync(fullPath).mtimeMs;
        return { fullPath, mtime };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { fullPath: string; mtime: number }[];

  if (jsonlFiles.length === 0) return null;
  jsonlFiles.sort((a, b) => b.mtime - a.mtime);
  return jsonlFiles[0].fullPath;
}

function lastAgentText(jsonlPath: string): { text: string; timestamp: string } | null {
  let content: string;
  try {
    content = readFileSync(jsonlPath, 'utf8');
  } catch {
    return null;
  }

  const lines = content.split('\n').filter(Boolean);
  let result: { text: string; timestamp: string } | null = null;

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'assistant') continue;
      const contentBlocks: unknown[] = obj.message?.content ?? [];
      for (const block of contentBlocks) {
        const b = block as { type?: string; text?: string };
        if (b.type === 'text' && b.text && b.text.trim()) {
          result = { text: b.text.trim(), timestamp: obj.timestamp ?? '' };
        }
      }
    } catch { /* skip */ }
  }

  return result;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!card.workDir) return NextResponse.json({ text: null });

  const projectName = encodeProjectPath(card.workDir);
  const projectDir = join(homedir(), '.claude', 'projects', projectName);
  const jsonlPath = latestJsonl(projectDir);
  if (!jsonlPath) return NextResponse.json({ text: null });

  const result = lastAgentText(jsonlPath);
  if (!result) return NextResponse.json({ text: null });

  return NextResponse.json({ text: result.text, timestamp: result.timestamp });
}
