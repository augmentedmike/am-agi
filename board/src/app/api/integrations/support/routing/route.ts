import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getSetting, setSetting } from '@/db/settings';
import { routingRuleSchema, routingRulesSchema } from '@/lib/ticket-router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getRules(db: ReturnType<typeof getDb>['db']) {
  const raw = getSetting(db, 'support_routing_rules');
  try {
    const parsed = routingRulesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const { db } = getDb();
  return NextResponse.json(getRules(db));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });

  const parsed = routingRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { db } = getDb();
  const rules = getRules(db);
  rules.push(parsed.data);
  setSetting(db, 'support_routing_rules', JSON.stringify(rules));

  return NextResponse.json(rules, { status: 201 });
}
