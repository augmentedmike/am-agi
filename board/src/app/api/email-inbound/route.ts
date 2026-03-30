import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { createCard, updateCard } from '@/db/cards';
import { evaluateRules } from '@/lib/automation-engine';
import { listRules } from '@/db/automations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Validate secret
  const secret = req.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.INBOUND_WEBHOOK_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    From?: string;
    Subject?: string;
    TextBody?: string;
  };

  const from = body.From ?? '';
  const subject = body.Subject ?? '';
  const text = body.TextBody ?? '';

  const { db } = getDb();

  const event = {
    type: 'email_inbound' as const,
    from,
    subject,
    body: text,
  };

  // Check if any enabled email_inbound rules exist
  const matchingRules = listRules(db).filter(r => r.enabled && r.triggerType === 'email_inbound');

  if (matchingRules.length > 0) {
    // Evaluate automation rules
    await evaluateRules(db, event);
  } else {
    // Fallback: create a card from the inbound email with a work log entry
    const card = createCard(db, {
      title: subject || `Email from ${from}`,
      priority: 'normal',
    });
    updateCard(db, card.id, {
      workLogEntry: {
        timestamp: new Date().toISOString(),
        message: `From: ${from}\n\n${text}`,
      },
    });
  }

  return NextResponse.json({ processed: true });
}
