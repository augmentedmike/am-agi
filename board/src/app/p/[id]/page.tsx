import type { Metadata } from 'next';
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  const name = project?.name ?? 'Project Board';
  const ogUrl = `/api/og?projectId=${encodeURIComponent(id)}`;
  return {
    title: `${name} · AM Board`,
    description: `Kanban board for ${name}`,
    openGraph: {
      title: `${name} · AM Board`,
      description: `Kanban board for ${name}`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} · AM Board`,
      description: `Kanban board for ${name}`,
      images: [ogUrl],
    },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, cards] = await Promise.all([getProject(id), getCards(id)]);
  if (!project) notFound();
  return <BoardClient initialCards={cards} initialProjectId={id} />;
}
