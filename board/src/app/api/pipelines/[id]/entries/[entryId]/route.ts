import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getEntry, moveEntry, removeEntry } from '@/db/pipelines';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  stageId: z.string().min(1),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { entryId } = await params;
  const { sqlite } = getDb();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const entry = moveEntry({ sqlite }, entryId, parsed.data.stageId);
  if (!entry) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(entry);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { entryId } = await params;
  const { sqlite } = getDb();
  const entry = getEntry({ sqlite }, entryId);
  if (!entry) return NextResponse.json({ error: 'not found' }, { status: 404 });
  removeEntry({ sqlite }, entryId);
  return new NextResponse(null, { status: 204 });
}
