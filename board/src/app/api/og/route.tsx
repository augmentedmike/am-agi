import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

const STATE_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  backlog:     { label: 'Backlog',     color: '#94a3b8', bg: '#1e293b' },
  'in-progress': { label: 'In Progress', color: '#60a5fa', bg: '#1e3a5f' },
  'in-review': { label: 'In Review',  color: '#fb923c', bg: '#3b1f0a' },
  shipped:     { label: 'Shipped',    color: '#4ade80', bg: '#0a2e1a' },
};

type Card = { id: string; title: string; state: string; priority: string };

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:4220';

async function fetchCards(projectId: string | null): Promise<Card[]> {
  try {
    const url = projectId
      ? `${BASE}/api/cards?projectId=${encodeURIComponent(projectId)}`
      : `${BASE}/api/cards?projectId=`;
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

async function fetchProjectName(projectId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/projects/${projectId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const p = await res.json();
    return p.name ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId') ?? null;

  const [cards, projectName] = await Promise.all([
    fetchCards(projectId),
    projectId ? fetchProjectName(projectId) : Promise.resolve(null),
  ]);

  const boardTitle = projectName ?? 'AM';

  const byState: Record<string, Card[]> = {};
  for (const s of STATES) byState[s] = [];
  for (const c of cards) {
    if (byState[c.state]) byState[c.state].push(c);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#18181b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#e4e4e7',
          padding: '0',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '24px 32px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '22px', fontWeight: 700, color: '#f4f4f5' }}>
            {boardTitle}
          </span>
          <span style={{ fontSize: '14px', color: '#52525b', marginTop: '2px' }}>
            · {cards.length} card{cards.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {STATES.map((state, i) => {
            const meta = STATE_COLORS[state];
            const col = byState[state];
            const top3 = col.slice(0, 3);
            const remaining = col.length - top3.length;

            return (
              <div
                key={state}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  borderRight: i < STATES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  padding: '0',
                }}
              >
                {/* Column header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '14px 20px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: `3px solid ${meta.color}`,
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: meta.color,
                    }}
                  >
                    {meta.label}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#52525b',
                    }}
                  >
                    {col.length}
                  </span>
                </div>

                {/* Cards */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px 14px',
                    flex: 1,
                  }}
                >
                  {top3.map(card => (
                    <div
                      key={card.id}
                      style={{
                        display: 'flex',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#d4d4d8',
                          lineHeight: '1.3',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {card.title}
                      </span>
                    </div>
                  ))}
                  {remaining > 0 && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#52525b',
                        paddingLeft: '2px',
                        marginTop: '2px',
                      }}
                    >
                      +{remaining} more
                    </span>
                  )}
                  {col.length === 0 && (
                    <span style={{ fontSize: '12px', color: '#3f3f46', paddingLeft: '2px' }}>
                      —
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '10px 24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ fontSize: '11px', color: '#3f3f46' }}>AM</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
