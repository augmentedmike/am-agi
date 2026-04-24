import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * @deprecated Use /api/provider-auth instead.
 * Redirects internally for backward compatibility.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerUrl = new URL('/api/provider-auth', url.origin);
  const res = await fetch(providerUrl.toString());
  const data = await res.json();
  return NextResponse.json(data);
}
