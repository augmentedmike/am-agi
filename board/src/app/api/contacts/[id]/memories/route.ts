import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getContact, getContactMemoryLinks, linkMemory, unlinkMemory } from '@/db/contacts';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const linkSchema = z.object({
  memoryId: z.string().min(1),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const contact = getContact(db, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const links = getContactMemoryLinks(db, id);
  return NextResponse.json(links);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const body = await req.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const link = linkMemory(db, id, parsed.data.memoryId);
  if (!link) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const body = await req.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const ok = unlinkMemory(db, id, parsed.data.memoryId);
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
