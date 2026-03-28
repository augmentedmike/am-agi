import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getChatMessage, updateChatMessage, deleteChatMessage } from '@/db/chat';
import { broadcast } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const msg = getChatMessage(db, id);
  if (!msg) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(msg);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const ok = deleteChatMessage(db, id);
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 });
  try { broadcast({ type: 'chat_message_deleted', id }); } catch {}
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const body = await req.json();
  const { content, status } = body;
  const msg = updateChatMessage(db, id, { content, status });
  if (!msg) return NextResponse.json({ error: 'not found' }, { status: 404 });
  try { broadcast({ type: 'chat_message_updated', message: msg }); } catch {}
  return NextResponse.json(msg);
}
