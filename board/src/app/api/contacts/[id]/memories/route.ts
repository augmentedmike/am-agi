import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getContact, listMemories, createMemory } from '@/db/contacts';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  content: z.string().min(1),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const contact = getContact({ sqlite }, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const memories = listMemories({ sqlite }, id);
  return NextResponse.json(memories);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const contact = getContact({ sqlite }, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const memory = createMemory({ sqlite }, id, parsed.data.content);
  return NextResponse.json(memory, { status: 201 });
}
