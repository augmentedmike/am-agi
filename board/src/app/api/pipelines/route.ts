import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { listPipelines, createPipeline, listStages } from '@/db/pipelines';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
});

export async function GET() {
  const { sqlite } = getDb();
  const pipelines = listPipelines({ sqlite });
  return NextResponse.json(pipelines.map(p => ({
    ...p,
    stages: listStages({ sqlite }, p.id),
  })));
}

export async function POST(req: NextRequest) {
  const { sqlite } = getDb();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const pipeline = createPipeline({ sqlite }, { name: parsed.data.name, description: parsed.data.description ?? null });
  return NextResponse.json({ ...pipeline, stages: listStages({ sqlite }, pipeline.id) }, { status: 201 });
}
