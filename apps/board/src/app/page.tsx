import { BoardClient } from '@/components/BoardClient';

export const dynamic = 'force-dynamic';

async function getCards() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:4200';
  try {
    // projectId='' → null (AM Board cards only)
    const res = await fetch(`${baseUrl}/api/cards?projectId=`, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const cards = await getCards();
  return <BoardClient initialCards={cards} initialProjectId={null} />;
}
