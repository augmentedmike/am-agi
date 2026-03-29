import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { listContacts, searchContacts, createContact } from '@/db/contacts';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  company: z.string().nullish(),
  title: z.string().nullish(),
  tags: z.string().nullish(),
  avatarUrl: z.string().url().nullish(),
});

export async function GET(req: NextRequest) {
  const { db, sqlite } = getDb();
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const contacts = q.trim() ? searchContacts({ sqlite }, q.trim()) : listContacts({ sqlite });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const contact = createContact({ sqlite }, {
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    company: parsed.data.company ?? null,
    title: parsed.data.title ?? null,
    tags: parsed.data.tags ?? null,
    avatarUrl: parsed.data.avatarUrl ?? null,
  });
  return NextResponse.json(contact, { status: 201 });
}
