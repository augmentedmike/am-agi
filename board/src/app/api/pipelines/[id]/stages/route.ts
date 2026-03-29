import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getPipeline, createStage } from '@/db/pipelines';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().nullish(),
  isTerminal: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sqlite } = getDb();
  const pipeline = getPipeline({ sqlite }, id);
  if (!pipeline) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const stage = createStage({ sqlite }, { pipelineId: id, name: parsed.data.name, color: parsed.data.color ?? null, isTerminal: parsed.data.isTerminal ?? false });
  return NextResponse.json(stage, { status: 201 });
}
