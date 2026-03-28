import { BoardClient } from '@/components/BoardClient';

export const dynamic = 'force-dynamic';

async function getAllCards() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:4220';
  try {
    // no projectId param → all cards across all projects
    const res = await fetch(`${baseUrl}/api/cards`, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export default async function AllProjectsPage() {
  const cards = await getAllCards();
  return <BoardClient initialCards={cards} />;
}
