import { BoardClient, type Card } from '@/components/BoardClient';
import { getDb } from '@/db/client';
import { listCards } from '@/db/cards';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let cards: Card[] = [];
  try {
    const { db } = getDb();
    cards = listCards(db, { projectId: null }) as Card[];
  } catch {
    cards = [];
  }
  return <BoardClient initialCards={cards} initialProjectId={null} />;
}
