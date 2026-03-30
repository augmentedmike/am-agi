import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { createEmail } from '@/db/emails';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  providerId: z.string().min(1),
  syncId: z.string().min(1),
  contactId: z.string().nullish(),
  threadId: z.string().nullish(),
  subject: z.string().nullish(),
  fromAddress: z.string().min(1),
  toAddresses: z.array(z.string()).optional(),
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
  const { sqlite } = getDb();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const email = createEmail({ sqlite }, {
    providerId: parsed.data.providerId,
    syncId: parsed.data.syncId,
    contactId: parsed.data.contactId ?? null,
    threadId: parsed.data.threadId ?? null,
    subject: parsed.data.subject ?? null,
    fromAddress: parsed.data.fromAddress,
    toAddresses: parsed.data.toAddresses,
    ccAddresses: parsed.data.ccAddresses,
    snippet: parsed.data.snippet ?? null,
    bodyText: parsed.data.bodyText ?? null,
    labels: parsed.data.labels,
    isRead: parsed.data.isRead,
    isStarred: parsed.data.isStarred,
    receivedAt: parsed.data.receivedAt,
    metadata: parsed.data.metadata,
  });
  return NextResponse.json(email, { status: 201 });
}
