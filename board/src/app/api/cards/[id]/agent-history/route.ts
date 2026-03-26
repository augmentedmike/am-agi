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

type AgentMessage = { text: string; timestamp: string };

function extractMessages(jsonlPath: string): AgentMessage[] {
  let content: string;
  try {
    content = readFileSync(jsonlPath, 'utf8');
  } catch {
    return [];
  }
  const messages: AgentMessage[] = [];
  for (const line of content.split('\n').filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'assistant') continue;
      for (const block of (obj.message?.content ?? []) as { type?: string; text?: string }[]) {
        if (block.type === 'text' && block.text?.trim()) {
          messages.push({ text: block.text.trim(), timestamp: obj.timestamp ?? '' });
        }
      }
    } catch { /* skip */ }
  }
  return messages;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!card.workDir) return NextResponse.json({ messages: [] });

  const projectName = encodeProjectPath(card.workDir);
  const projectDir = join(homedir(), '.claude', 'projects', projectName);

  let jsonlFiles: { fullPath: string; mtime: number }[] = [];
  try {
    jsonlFiles = (readdirSync(projectDir, { encoding: 'utf8' }) as string[])
      .filter(e => e.endsWith('.jsonl'))
      .map(name => {
        const fullPath = join(projectDir, name);
        try { return { fullPath, mtime: statSync(fullPath).mtimeMs }; }
        catch { return null; }
      })
      .filter(Boolean) as { fullPath: string; mtime: number }[];
    jsonlFiles.sort((a, b) => a.mtime - b.mtime);
  } catch { /* dir missing */ }

  const all: AgentMessage[] = [];
  for (const f of jsonlFiles) all.push(...extractMessages(f.fullPath));

  all.reverse(); // newest first

  return NextResponse.json({ messages: all });
}
