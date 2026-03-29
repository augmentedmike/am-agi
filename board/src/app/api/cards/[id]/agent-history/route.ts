import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getDb } from '@/db/client';
import { getCard } from '@/db/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function encodeProjectPath(absPath: string): string {
  return absPath.replace(/\//g, '-');
}

type ChatEntry = { role: 'user' | 'assistant'; text: string; timestamp: string };

function extractAgentMessages(jsonlPath: string): ChatEntry[] {
  let content: string;
  try { content = readFileSync(jsonlPath, 'utf8'); } catch { return []; }
  const messages: ChatEntry[] = [];
  for (const line of content.split('\n').filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'assistant') continue;
      for (const block of (obj.message?.content ?? []) as { type?: string; text?: string }[]) {
        if (block.type === 'text' && block.text?.trim()) {
          messages.push({ role: 'assistant', text: block.text.trim(), timestamp: obj.timestamp ?? '' });
        }
      }
    } catch { /* skip */ }
  }
  return messages;
}

function getAgentMessages(workDir: string): ChatEntry[] {
  const projectName = encodeProjectPath(workDir);
  const projectDir = join(homedir(), '.claude', 'projects', projectName);
  let jsonlFiles: { fullPath: string; mtime: number }[] = [];
  try {
    jsonlFiles = (readdirSync(projectDir, { encoding: 'utf8' }) as string[])
      .filter(e => e.endsWith('.jsonl'))
      .map(name => {
        const fullPath = join(projectDir, name);
        try { return { fullPath, mtime: statSync(fullPath).mtimeMs }; } catch { return null; }
      })
      .filter(Boolean) as { fullPath: string; mtime: number }[];
    jsonlFiles.sort((a, b) => a.mtime - b.mtime);
  } catch { /* dir missing */ }
  const all: ChatEntry[] = [];
  for (const f of jsonlFiles) all.push(...extractAgentMessages(f.fullPath));
  return all;
}

function getUserMessages(workDir: string): ChatEntry[] {
  try { return JSON.parse(readFileSync(join(workDir, 'card-messages.json'), 'utf8')) as ChatEntry[]; }
  catch { return []; }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!card.workDir) return NextResponse.json({ messages: [] });

  const all = [...getAgentMessages(card.workDir), ...getUserMessages(card.workDir)]
    .sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));

  return NextResponse.json({ messages: all });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!card.workDir) return NextResponse.json({ error: 'no workDir' }, { status: 400 });

  const { content } = await req.json() as { content?: string };
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const entry: ChatEntry = { role: 'user', text: content.trim(), timestamp: new Date().toISOString() };

  // Save to card-messages.json (chat history)
  const msgs = getUserMessages(card.workDir);
  msgs.push(entry);
  writeFileSync(join(card.workDir, 'card-messages.json'), JSON.stringify(msgs, null, 2), 'utf8');

  // Append to user-notes.md so the agent picks it up on next iteration
  const notesFile = join(card.workDir, 'user-notes.md');
  const noteEntry = `\n---\n[${entry.timestamp}] ${entry.text}\n`;
  try {
    const current = existsSync(notesFile) ? readFileSync(notesFile, 'utf8') : '# User Notes\n';
    writeFileSync(notesFile, current + noteEntry, 'utf8');
  } catch { /* best-effort */ }

  return NextResponse.json(entry, { status: 201 });
}
