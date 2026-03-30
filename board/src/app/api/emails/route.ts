import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { createEmail } from '@/db/emails';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createEmailSchema = z.object({
  providerId: z.string().min(1),
  syncId: z.string().min(1),
  contactId: z.string().nullish(),
  threadId: z.string().nullish(),
  subject: z.string().nullish(),
  fromAddress: z.string().min(1),
  toAddresses: z.array(z.string()),
  ccAddresses: z.array(z.string()).optional(),
  snippet: z.string().nullish(),
  bodyText: z.string().nullish(),
  labels: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  receivedAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = createEmailSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const email = createEmail({ sqlite }, parsed.data);
  return NextResponse.json(email, { status: 201 });
}
