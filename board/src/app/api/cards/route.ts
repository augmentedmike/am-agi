import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { listCards, createCard } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';
import { evaluateRules } from '@/lib/automation-engine';
import { listSchema, createSchema } from './schema';
import { AM_BOARD_PROJECT_ID } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notifyClients(event: unknown) {
  try { broadcast(event); } catch {}
}

export async function GET(req: NextRequest) {
  const { db, sqlite } = getDb();
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = listSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const hasProjectId = req.nextUrl.searchParams.has('projectId');
  const filters = {
    ...parsed.data,
    ...(hasProjectId ? { projectId: parsed.data.projectId || AM_BOARD_PROJECT_ID } : {}),
    all: parsed.data.all === true,
  };
  const result = listCards(db, filters);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const card = createCard(db, parsed.data);
  notifyClients({ type: 'card_created', card });
  // Fire automation rules asynchronously — don't block the response
  evaluateRules(db, {
    type: 'card_created',
    card: {
      id: card.id,
      title: card.title,
      state: card.state,
      priority: card.priority,
      project_id: card.projectId,
    },
  }).catch(err => console.error('[automation] card_created eval failed:', err));
  return NextResponse.json(card, { status: 201 });
}
