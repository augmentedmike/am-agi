import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getContact, updateContact, deleteContact } from '@/db/contacts';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  company: z.string().nullish(),
  title: z.string().nullish(),
  tags: z.string().nullish(),
  avatarUrl: z.string().url().nullish(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const contact = getContact({ sqlite }, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const contact = updateContact({ sqlite }, id, {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...('email' in parsed.data ? { email: parsed.data.email ?? null } : {}),
    ...('phone' in parsed.data ? { phone: parsed.data.phone ?? null } : {}),
    ...('company' in parsed.data ? { company: parsed.data.company ?? null } : {}),
    ...('title' in parsed.data ? { title: parsed.data.title ?? null } : {}),
    ...('tags' in parsed.data ? { tags: parsed.data.tags ?? null } : {}),
    ...('avatarUrl' in parsed.data ? { avatarUrl: parsed.data.avatarUrl ?? null } : {}),
  });
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const existing = getContact({ sqlite }, id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  deleteContact({ sqlite }, id);
  return new NextResponse(null, { status: 204 });
}
