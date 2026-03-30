import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { getSetting, setSetting } from '@/db/settings';
import { loadRulesFromJson } from '@/lib/ticket-router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ruleSchema = z.object({
  match: z.object({
    field: z.enum(['severity', 'product', 'source']),
    op: z.enum(['eq', 'contains']),
    value: z.string().min(1),
  }),
  assign: z.object({
    column: z.string().optional(),
    assignee: z.string().optional(),
  }),
});

function getRules(db: ReturnType<typeof getDb>['db']) {
  const json = getSetting(db, 'support_routing_rules' as Parameters<typeof getSetting>[1]);
  return loadRulesFromJson(json || '[]');
}

export async function GET() {
  const { db } = getDb();
  return NextResponse.json(getRules(db));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { db } = getDb();
  const rules = getRules(db);
  rules.push(parsed.data);
  setSetting(db, 'support_routing_rules', JSON.stringify(rules));
  return NextResponse.json(rules, { status: 201 });
}
