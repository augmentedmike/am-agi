import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getStage, updateStage, deleteStage, getEntriesInStage } from '@/db/pipelines';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().nullish(),
  position: z.number().int().optional(),
  isTerminal: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { stageId } = await params;
  const { sqlite } = getDb();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const stage = updateStage({ sqlite }, stageId, {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...('color' in parsed.data ? { color: parsed.data.color ?? null } : {}),
    ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
    ...(parsed.data.isTerminal !== undefined ? { isTerminal: parsed.data.isTerminal } : {}),
  });
  if (!stage) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(stage);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { stageId } = await params;
  const { sqlite } = getDb();
  const stage = getStage({ sqlite }, stageId);
  if (!stage) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const count = getEntriesInStage({ sqlite }, stageId);
  if (count > 0) return NextResponse.json({ error: 'stage has entries, move them first' }, { status: 400 });
  deleteStage({ sqlite }, stageId);
  return new NextResponse(null, { status: 204 });
}
