import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

async function getCard(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/cards/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = await getCard(id);
  const title = card ? `${card.title} — AM` : 'Card — AM';
  const description = card
    ? `${card.title} · ${card.state} · ${card.priority} priority`
    : 'View this card on AM.';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://board.helloam.bot/cards/${id}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  normal: 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30',
  low: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
};

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 max-w-3xl mx-auto">
      <Link href="/" className="text-pink-500 hover:text-pink-400 text-sm mb-6 block transition-colors">
        ← Board
      </Link>
      <h1 className="text-2xl font-bold mb-3 text-zinc-100">{card.title}</h1>
      <div className="flex gap-2 mb-8">
        <span className="text-sm bg-zinc-800/60 border border-white/10 px-2 py-1 rounded-lg text-zinc-300">
          {card.state}
        </span>
        <span className={`text-sm px-2 py-1 rounded-lg font-medium ${PRIORITY_BADGE[card.priority]}`}>
          {card.priority}
        </span>
      </div>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 text-zinc-100">Work Log</h2>
        {card.workLog.length === 0 ? (
          <p className="text-zinc-500 text-sm">No entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {card.workLog.map((entry: { timestamp: string; message: string }, i: number) => (
              <li key={i} className="bg-zinc-800/60 backdrop-blur-sm border border-white/10 rounded-xl p-3">
                <p className="text-xs text-zinc-400 mb-1">{entry.timestamp}</p>
                <p className="text-sm text-zinc-100">{entry.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 text-zinc-100">Attachments</h2>
        {card.attachments.length === 0 ? (
          <p className="text-zinc-500 text-sm">No attachments.</p>
        ) : (
          <ul className="space-y-1">
            {card.attachments.map((a: { path: string; name: string }, i: number) => (
              <li key={i} className="text-sm text-pink-400">
                {a.name} — <span className="text-zinc-400">{a.path}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
