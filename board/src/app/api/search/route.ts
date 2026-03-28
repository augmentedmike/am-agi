import { execSync } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AM_ROOT = path.resolve(process.cwd(), '..');
const VAULT_BIN = path.join(AM_ROOT, 'bin', 'vault');

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

type TavilyResponse = {
  results?: TavilyResult[];
};

export async function POST(req: NextRequest) {
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { query } = body;
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = execSync(`${VAULT_BIN} get tavily_api_key`, { encoding: 'utf8' }).trim();
  } catch {
    return NextResponse.json({ error: 'tavily_api_key not set' }, { status: 503 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'tavily_api_key not set' }, { status: 503 });
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Tavily error: ${res.status} ${text}` }, { status: 502 });
    }

    const data = (await res.json()) as TavilyResponse;
    const results = (data.results ?? []).map((r: TavilyResult) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
