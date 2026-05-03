import { EmbedBoard } from '@/components/EmbedBoard';

export const dynamic = 'force-dynamic';

async function getCards() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:4220';
  try {
    const res = await fetch(`${base}/api/cards?projectId=`, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export default async function EmbedPage() {
  const cards = await getCards();
  return <EmbedBoard cards={cards} title="AM" />;
}
