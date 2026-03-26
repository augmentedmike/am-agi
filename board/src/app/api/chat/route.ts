import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { listChatMessages, createChatMessage } from '@/db/chat';
import { broadcast } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const params = req.nextUrl.searchParams;
  const status = params.get('status') as 'pending' | 'processing' | 'done' | 'error' | null;
  const limit = params.get('limit') ? parseInt(params.get('limit')!, 10) : 50;
  const search = params.get('search') ?? undefined;
  const messages = listChatMessages(db, { status: status ?? undefined, limit, search });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const body = await req.json();
  const { role, content, replyToId } = body;
  if (!role || !content) return NextResponse.json({ error: 'role and content required' }, { status: 400 });
  const msg = createChatMessage(db, { role, content, replyToId });
  try { broadcast({ type: 'chat_message', message: msg }); } catch {}
  return NextResponse.json(msg, { status: 201 });
}
