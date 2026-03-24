import { notFound } from 'next/navigation';
import Link from 'next/link';

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

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-3xl mx-auto">
      <Link href="/" className="text-blue-400 hover:underline text-sm mb-4 block">← Board</Link>
      <h1 className="text-2xl font-bold mb-2">{card.title}</h1>
      <div className="flex gap-2 mb-6">
        <span className="text-sm bg-gray-800 px-2 py-1 rounded">{card.state}</span>
        <span className="text-sm bg-gray-800 px-2 py-1 rounded">{card.priority}</span>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Work Log</h2>
        {card.workLog.length === 0 ? (
          <p className="text-gray-500 text-sm">No entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {card.workLog.map((entry: { timestamp: string; message: string }, i: number) => (
              <li key={i} className="bg-gray-900 rounded p-3">
                <p className="text-xs text-gray-400 mb-1">{entry.timestamp}</p>
                <p className="text-sm">{entry.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Attachments</h2>
        {card.attachments.length === 0 ? (
          <p className="text-gray-500 text-sm">No attachments.</p>
        ) : (
          <ul className="space-y-1">
            {card.attachments.map((a: { path: string; name: string }, i: number) => (
              <li key={i} className="text-sm text-blue-400">{a.name} — <span className="text-gray-400">{a.path}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
