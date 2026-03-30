import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getContact } from '@/db/contacts';
import { listEmailsByContact } from '@/db/emails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const contact = getContact({ sqlite }, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const emailList = listEmailsByContact({ sqlite }, id);
  return NextResponse.json(emailList);
}
