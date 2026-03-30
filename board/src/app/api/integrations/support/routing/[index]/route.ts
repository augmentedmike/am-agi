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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ index: string }> }) {
  const { index: indexStr } = await params;
  const index = parseInt(indexStr, 10);

  const { db } = getDb();
  const rules = getRules(db);

  if (isNaN(index) || index < 0 || index >= rules.length) {
    return NextResponse.json({ error: 'index out of range' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });

  const parsed = routingRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  rules[index] = parsed.data;
  setSetting(db, 'support_routing_rules', JSON.stringify(rules));

  return NextResponse.json(rules);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ index: string }> }) {
  const { index: indexStr } = await params;
  const index = parseInt(indexStr, 10);

  const { db } = getDb();
  const rules = getRules(db);

  if (isNaN(index) || index < 0 || index >= rules.length) {
    return NextResponse.json({ error: 'index out of range' }, { status: 404 });
  }

  rules.splice(index, 1);
  setSetting(db, 'support_routing_rules', JSON.stringify(rules));

  return NextResponse.json(rules);
}
