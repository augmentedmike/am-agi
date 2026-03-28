import { BoardClient, type Card } from '@/components/BoardClient';
import { getDb } from '@/db/client';
import { listCards } from '@/db/cards';
import { AM_BOARD_PROJECT_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let cards: Card[] = [];
  try {
    const { db } = getDb();
    cards = listCards(db, { projectId: AM_BOARD_PROJECT_ID }) as Card[];
  } catch {
    cards = [];
  }
  return <BoardClient initialCards={cards} initialProjectId={AM_BOARD_PROJECT_ID} />;
}
