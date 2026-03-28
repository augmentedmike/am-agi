'use server';

import { BoardClient } from '@/components/BoardClient';
import { getDb } from '@/db/client';
import { listCards } from '@/db/cards';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let cards: ReturnType<typeof listCards> = [];
  try {
    const { db } = getDb();
    cards = listCards(db, { projectId: null });
  } catch {
    cards = [];
  }
  return <BoardClient initialCards={cards} initialProjectId={null} />;
}
