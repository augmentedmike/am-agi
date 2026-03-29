import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getPipeline, updatePipeline, deletePipeline, listPipelines, listStages, listEntries } from '@/db/pipelines';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sqlite } = getDb();
  const pipeline = getPipeline({ sqlite }, id);
  if (!pipeline) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const stages = listStages({ sqlite }, id);
  const entries = listEntries({ sqlite }, id);
  const stageCounts: Record<string, number> = {};
  for (const s of stages) {
    stageCounts[s.id] = entries.filter(e => e.stageId === s.id).length;
  }
  return NextResponse.json({ ...pipeline, stages: stages.map(s => ({ ...s, entryCount: stageCounts[s.id] ?? 0 })) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sqlite } = getDb();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const pipeline = updatePipeline({ sqlite }, id, {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...('description' in parsed.data ? { description: parsed.data.description ?? null } : {}),
  });
  if (!pipeline) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(pipeline);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sqlite } = getDb();
  const allPipelines = listPipelines({ sqlite });
  if (allPipelines.length <= 1) return NextResponse.json({ error: 'cannot delete last pipeline' }, { status: 400 });
  const pipeline = getPipeline({ sqlite }, id);
  if (!pipeline) return NextResponse.json({ error: 'not found' }, { status: 404 });
  deletePipeline({ sqlite }, id);
  return new NextResponse(null, { status: 204 });
}
