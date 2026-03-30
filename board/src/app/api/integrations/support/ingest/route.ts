import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { createCard, linkContactToCard, listCards, updateCard } from '@/db/cards';
import { createContact, searchContacts } from '@/db/contacts';
import { getSetting } from '@/db/settings';
import { loadRulesFromJson, routeTicket } from '@/lib/ticket-router';
import { broadcast } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ingestSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  severity: z.string().optional(),
  product: z.string().optional(),
  source: z.string().optional(),
});

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(`sha256=${expected}`, 'utf8');
  const actualBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-support-signature') ?? '';

  const { db, sqlite } = getDb();
  const secret = getSetting(db, 'support_webhook_secret' as Parameters<typeof getSetting>[1]);

  if (!secret || !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid or missing signature' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, subject, severity, product, source } = parsed.data;

  // Load routing rules and determine target column
  const rulesJson = getSetting(db, 'support_routing_rules' as Parameters<typeof getSetting>[1]);
  const rules = loadRulesFromJson(rulesJson || '[]');
  const routing = routeTicket(rules, { severity, product, source });

  // Create ticket card
  const card = createCard(db, {
    title: subject,
    cardType: 'ticket',
    entityFields: {
      email,
      subject,
      severity: severity ?? null,
      product: product ?? null,
      source: source ?? null,
      assignee: routing.assignee ?? null,
      routedColumn: routing.column,
    },
  });

  // Upsert contact in contacts table
  const existingContacts = searchContacts({ sqlite }, email);
  let contactId: string;
  const existingContact = existingContacts.find((c) => c.email === email);
  if (existingContact) {
    contactId = existingContact.id;
  } else {
    const namePart = email.split('@')[0];
    const contact = createContact({ sqlite }, { name: namePart, email });
    contactId = contact.id;
  }

  // Find or create a contact-type card for this email, then link to ticket
  const allContactCards = listCards(db, { cardType: 'contact' });
  const existingContactCard = allContactCards.find(
    (c) => (c.entityFields as Record<string, unknown>)?.email === email
  );
  let contactCardId: string;
  if (existingContactCard) {
    contactCardId = existingContactCard.id;
  } else {
    const namePart = email.split('@')[0];
    const newContactCard = createCard(db, {
      title: namePart,
      cardType: 'contact',
      entityFields: { email, contactId },
    });
    contactCardId = newContactCard.id;
  }
  linkContactToCard(db, card.id, contactCardId);

  // Broadcast ticket_created event
  broadcast({ type: 'ticket_created', card: { ...card, routedColumn: routing.column } });

  return NextResponse.json({ id: card.id, routedColumn: routing.column }, { status: 201 });
}
