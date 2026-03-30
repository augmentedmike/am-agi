import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { upsertEmail } from '@/db/emails';
import { getSetting } from '@/db/settings';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { db } = getDb();

  const host = getSetting(db, 'imap_host' as Parameters<typeof getSetting>[1]);
  const port = parseInt(getSetting(db, 'imap_port' as Parameters<typeof getSetting>[1]) || '993', 10);
  const user = getSetting(db, 'imap_user' as Parameters<typeof getSetting>[1]);
  const pass = getSetting(db, 'imap_pass' as Parameters<typeof getSetting>[1]);
  const tls = getSetting(db, 'imap_tls' as Parameters<typeof getSetting>[1]) !== 'false';

  if (!host || !user || !pass) {
    return NextResponse.json({ error: 'IMAP credentials not configured' }, { status: 400 });
  }

  let synced = 0;
  try {
    // Dynamic import so the module is optional at build time
    const { ImapFlow } = await import('imapflow');
    const client = new ImapFlow({
      host,
      port,
      secure: tls,
      auth: { user, pass },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const msg of client.fetch('1:*', {
        envelope: true,
        bodyStructure: true,
        source: true,
      })) {
        const env = msg.envelope ?? {};
        const id = randomUUID();
        const date = env.date ? new Date(env.date).toISOString() : new Date().toISOString();
        const now = new Date().toISOString();

        const toAddresses = (env.to ?? []).map((a: { address?: string }) => a.address ?? '').filter(Boolean);
        const ccAddresses = (env.cc ?? []).map((a: { address?: string }) => a.address ?? '').filter(Boolean);
        const fromAddr = env.from?.[0];

        // Use messageId as natural key for upsert dedup
        const msgId = env.messageId ?? id;

        await upsertEmail(db, {
          id: msgId,
          messageId: msgId,
          inReplyTo: env.inReplyTo ?? null,
          references: null,
          fromAddress: fromAddr?.address ?? '',
          fromName: fromAddr?.name ?? fromAddr?.address ?? '',
          toAddresses,
          ccAddresses,
          subject: env.subject ?? '(no subject)',
          bodyText: '',
          bodyHtml: '',
          attachments: [],
          folder: 'INBOX',
          isRead: false,
          isStarred: false,
          date,
          createdAt: now,
          updatedAt: now,
        });
        synced++;
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ synced });
}
