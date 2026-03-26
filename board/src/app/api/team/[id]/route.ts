import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getTeamMember, updateTeamMember, deleteTeamMember } from '@/db/team';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  jobTitle: z.string().optional(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
  availability: z.enum(['available', 'busy', 'away', 'offline']).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const member = getTeamMember(db, id);
  if (!member) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(member);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const member = updateTeamMember(db, id, parsed.data);
  if (!member) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(member);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const existing = getTeamMember(db, id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  deleteTeamMember(db, id);
  return new NextResponse(null, { status: 204 });
}
