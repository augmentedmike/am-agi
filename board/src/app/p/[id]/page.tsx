import { notFound } from 'next/navigation';
import { BoardClient } from '@/components/BoardClient';

export const dynamic = 'force-dynamic';

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:4220';

async function getProject(id: string) {
  try {
    const res = await fetch(`${BASE}/api/projects/${id}`, { cache: 'no-store' });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function getCards(projectId: string) {
  try {
    const res = await fetch(`${BASE}/api/cards?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch { return []; }
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, cards] = await Promise.all([getProject(id), getCards(id)]);
  if (!project) notFound();
  return <BoardClient initialCards={cards} initialProjectId={id} />;
}
