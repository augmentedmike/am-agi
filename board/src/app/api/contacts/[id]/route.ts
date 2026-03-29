import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getContact, updateContact, deleteContact } from '@/db/contacts';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  kind: z.enum(['person', 'company']).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  linkedMemoryIds: z.array(z.string()).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const contact = getContact(db, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const contact = updateContact(db, id, parsed.data);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const existing = getContact(db, id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  deleteContact(db, id);
  return new NextResponse(null, { status: 204 });
}
