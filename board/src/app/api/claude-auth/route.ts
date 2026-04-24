import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
<<<<<<< HEAD
 * @deprecated Use /api/provider-auth instead.
 * Redirects internally for backward compatibility.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerUrl = new URL('/api/provider-auth', url.origin);
  const res = await fetch(providerUrl.toString());
=======
 * @deprecated Use /api/provider-auth instead. This endpoint proxies to it
 * for backward compatibility.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerUrl = `${url.origin}/api/provider-auth`;
  const res = await fetch(providerUrl);
>>>>>>> 1bd92c5 (make claude code optional, support hermes + qwen3 providers)
  const data = await res.json();
  return NextResponse.json(data);
}
