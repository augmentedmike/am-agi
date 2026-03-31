import { notFound } from 'next/navigation';
import { EmbedBoard } from '@/components/EmbedBoard';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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

export default async function EmbedProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project, cards] = await Promise.all([getProject(projectId), getCards(projectId)]);
  if (!project) notFound();
  return <EmbedBoard cards={cards} title={project.name ?? 'Project Board'} />;
}
