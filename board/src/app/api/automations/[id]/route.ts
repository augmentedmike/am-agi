import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { getRule, updateRule, deleteRule } from '@/db/automations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  project_id: z.string().optional().nullable(),
  trigger_type: z.enum(['card_state_change', 'card_created', 'email_inbound']).optional(),
  trigger_conditions: z.record(z.string(), z.unknown()).optional(),
  action_type: z.enum(['send_email', 'create_card', 'move_card', 'log_entry']).optional(),
  action_params: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = getRule(db, id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { name, enabled, project_id, trigger_type, trigger_conditions, action_type, action_params } = parsed.data;
  const updated = updateRule(db, id, {
    ...(name !== undefined ? { name } : {}),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(project_id !== undefined ? { projectId: project_id } : {}),
    ...(trigger_type !== undefined ? { triggerType: trigger_type } : {}),
    ...(trigger_conditions !== undefined ? { triggerConditions: trigger_conditions as Record<string, string> } : {}),
    ...(action_type !== undefined ? { actionType: action_type } : {}),
    ...(action_params !== undefined ? { actionParams: action_params as Record<string, string> } : {}),
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const deleted = deleteRule(db, id);
  if (!deleted) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
