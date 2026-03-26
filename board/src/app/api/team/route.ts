import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { listTeamMembers, createTeamMember } from '@/db/team';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  jobTitle: z.string().optional(),
  role: z.enum(['owner', 'manager', 'expert', 'tester']).optional(),
  avatarUrl: z.string().url().optional(),
});

export async function GET() {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const members = listTeamMembers(db);
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const member = createTeamMember(db, parsed.data);
  return NextResponse.json(member, { status: 201 });
}
