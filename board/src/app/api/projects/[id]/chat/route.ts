import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';
import { listChatMessages, createChatMessage } from '@/db/chat';
import { broadcast } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const messages = listChatMessages(db, { projectId: id });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json();
  const { role, content, replyToId } = body;
  if (!role || !content) return NextResponse.json({ error: 'role and content required' }, { status: 400 });
  const msg = createChatMessage(db, { role, content, replyToId, projectId: id });
  try { broadcast({ type: 'chat_message', message: msg }); } catch {}
  return NextResponse.json(msg, { status: 201 });
}
