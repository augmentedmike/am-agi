import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { createCard } from '@/db/cards';
import { getSetting } from '@/db/settings';
import { broadcast } from '@/lib/ws-store';
import { loadRules, routeTicket } from '@/lib/ticket-router';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { cards, cardContacts } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Zod schema ──────────────────────────────────────────────────────────────

const ingestSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(1),
  body: z.string(),
  severity: z.string().optional(),
  product: z.string().optional(),
  source: z.string().optional(),
});

// ─── HMAC verification ────────────────────────────────────────────────────────

function verifySignature(secret: string, rawBody: string, signature: string): boolean {
  if (!secret) return false;
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature.replace(/^sha256=/, ''));
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

// ─── Contact upsert ───────────────────────────────────────────────────────────

function upsertContactCard(db: ReturnType<typeof getDb>['db'], email: string): string {
  // Look for an existing contact card with this email in entityFields
  const existing = db
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.cardType, 'contact'))
    .all()
    .find((c) => {
      const card = db.select().from(cards).where(eq(cards.id, c.id)).get();
      return (card?.entityFields as Record<string, unknown>)?.email === email;
    });

  if (existing) return existing.id;

  const contact = createCard(db, {
    title: email,
    cardType: 'contact',
    entityFields: { email },
  });
  return contact.id;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-support-signature') ?? '';

  const { db } = getDb();

  // Verify HMAC signature
  const secret = getSetting(db, 'support_webhook_secret');
  if (!verifySignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'invalid or missing signature' }, { status: 401 });
  }

  // Parse and validate body
  let json: unknown;
  try { json = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const parsed = ingestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, subject, body, severity, product, source } = parsed.data;

  // Route the ticket
  const rules = loadRules(db);
  const { column, assignee } = routeTicket(rules, { severity, product, source });

  // Build entityFields
  const entityFields: Record<string, string | null> = {
    email,
    body,
    column,
    ...(severity != null ? { severity } : {}),
    ...(product != null ? { product } : {}),
    ...(source != null ? { source } : {}),
    ...(assignee != null ? { assignee } : {}),
  };

  // Create ticket card
  const card = createCard(db, {
    title: subject,
    cardType: 'ticket',
    entityFields,
  });

  // Upsert contact and link
  const contactCardId = upsertContactCard(db, email);
  const now = new Date().toISOString();
  try {
    db.insert(cardContacts).values({ id: randomUUID(), cardId: card.id, contactCardId, createdAt: now }).run();
  } catch {
    // already linked — ignore
  }

  // Broadcast
  try { broadcast({ type: 'ticket_created', card, contactCardId }); } catch {}

  return NextResponse.json({ card, column, assignee }, { status: 201 });
}
