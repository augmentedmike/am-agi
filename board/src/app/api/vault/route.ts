import { execSync } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AM_ROOT = path.resolve(process.cwd(), '..');
const VAULT_BIN = path.join(AM_ROOT, 'bin', 'vault');

export async function GET() {
  try {
    const output = execSync(`${VAULT_BIN} list`, { encoding: 'utf8' }).trim();
    const keys = output.split('\n').filter(Boolean);
    return NextResponse.json({ keys });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { key?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { key, value } = body;
  if (!key || !value) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return NextResponse.json({ error: 'Invalid key name — only alphanumerics, underscores, and hyphens allowed' }, { status: 400 });
  }

  try {
    execSync(`${VAULT_BIN} set ${key}`, { input: value, encoding: 'utf8' });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'key query param required' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return NextResponse.json({ error: 'Invalid key name' }, { status: 400 });
  }

  try {
    execSync(`${VAULT_BIN} rm ${key}`, { encoding: 'utf8' });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('No such')) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
