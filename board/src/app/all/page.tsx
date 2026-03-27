import { AllProjectsBoard } from '@/components/AllProjectsBoard';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:4220';

async function getProjects() {
  try {
    const res = await fetch(`${BASE_URL}/api/projects`, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

async function getAllCards() {
  try {
    // no projectId param → all cards
    const res = await fetch(`${BASE_URL}/api/cards`, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export default async function AllProjectsPage() {
  const [projects, cards] = await Promise.all([getProjects(), getAllCards()]);
  return <AllProjectsBoard initialProjects={projects} initialCards={cards} />;
}
