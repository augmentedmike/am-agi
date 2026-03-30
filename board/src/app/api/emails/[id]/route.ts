import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getEmail, deleteEmail } from '@/db/emails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sqlite } = getDb();
  const email = getEmail({ sqlite }, id);
  if (!email) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(email);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sqlite } = getDb();
  const existing = getEmail({ sqlite }, id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  deleteEmail({ sqlite }, id);
  return new NextResponse(null, { status: 204 });
}
