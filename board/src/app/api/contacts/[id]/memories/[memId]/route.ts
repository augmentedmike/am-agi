import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { deleteMemory } from '@/db/contacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; memId: string }> }) {
  const { memId } = await params;
  const { db, sqlite } = getDb();
  deleteMemory({ sqlite }, memId);
  return new NextResponse(null, { status: 204 });
}
