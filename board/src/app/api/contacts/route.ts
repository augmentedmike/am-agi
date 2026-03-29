import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { listContacts, createContact } from '@/db/contacts';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  kind: z.enum(['person', 'company']).optional(),
  name: z.string().min(1),
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

export async function GET() {
  const { db } = getDb();
  const items = listContacts(db);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { db } = getDb();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const contact = createContact(db, parsed.data);
  return NextResponse.json(contact, { status: 201 });
}
