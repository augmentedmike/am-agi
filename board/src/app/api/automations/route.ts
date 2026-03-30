import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { listRules, createRule } from '@/db/automations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional(),
  project_id: z.string().optional().nullable(),
  trigger_type: z.enum(['card_state_change', 'card_created', 'email_inbound']),
  trigger_conditions: z.record(z.string(), z.unknown()).optional(),
  action_type: z.enum(['send_email', 'create_card', 'move_card', 'log_entry']),
  action_params: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  const { db } = getDb();
  const projectId = req.nextUrl.searchParams.get('project_id') ?? undefined;
  const rules = listRules(db, projectId ? { projectId } : undefined);
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const { db } = getDb();
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, enabled, project_id, trigger_type, trigger_conditions, action_type, action_params } = parsed.data;
  const rule = createRule(db, {
    name,
    enabled,
    projectId: project_id,
    triggerType: trigger_type,
    triggerConditions: (trigger_conditions ?? {}) as Record<string, string>,
    actionType: action_type,
    actionParams: (action_params ?? {}) as Record<string, string>,
  });
  return NextResponse.json(rule, { status: 201 });
}
