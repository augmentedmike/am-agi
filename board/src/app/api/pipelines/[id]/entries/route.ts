import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getPipeline, listEntries, addContactToPipeline } from '@/db/pipelines';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const addSchema = z.object({
  contactId: z.string().min(1),
  stageId: z.string().min(1),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sqlite } = getDb();
  const pipeline = getPipeline({ sqlite }, id);
  if (!pipeline) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(listEntries({ sqlite }, id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sqlite } = getDb();
  const pipeline = getPipeline({ sqlite }, id);
  if (!pipeline) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const entry = addContactToPipeline({ sqlite }, { contactId: parsed.data.contactId, pipelineId: id, stageId: parsed.data.stageId });
  return NextResponse.json(entry, { status: 201 });
}
