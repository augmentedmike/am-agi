import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { listContacts, createContact } from '@/db/contacts';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  company: z.string().nullish(),
  notes: z.string().nullish(),
  tags: z.array(z.string()).optional(),
});

export async function GET() {
  const { db } = getDb();
  return NextResponse.json(listContacts(db));
}

export async function POST(req: NextRequest) {
  const { db } = getDb();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const contact = createContact(db, parsed.data);
  return NextResponse.json(contact, { status: 201 });
}
