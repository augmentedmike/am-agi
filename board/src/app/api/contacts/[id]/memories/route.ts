import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getContact, listContactMemories, addContactMemory, removeContactMemory } from '@/db/contacts';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  memoryRef: z.string().min(1),
  memoryTerm: z.enum(['st', 'lt']),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const contact = getContact(db, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(listContactMemories(db, id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const contact = getContact(db, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const row = addContactMemory(db, id, parsed.data);
    return NextResponse.json(row, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'already associated' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const contact = getContact(db, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');
  if (!ref) return NextResponse.json({ error: 'ref query param required' }, { status: 400 });

  removeContactMemory(db, id, ref);
  return new NextResponse(null, { status: 204 });
}
