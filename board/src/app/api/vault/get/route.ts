import { execSync } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AM_ROOT = path.resolve(process.cwd(), '..');
const VAULT_BIN = path.join(AM_ROOT, 'bin', 'vault');

export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key || !/^[a-zA-Z0-9_-]+$/.test(key)) {
    return NextResponse.json({ error: 'key required' }, { status: 400 });
  }
  try {
    const value = execSync(`${VAULT_BIN} get ${key}`, { encoding: 'utf8' }).trim();
    return NextResponse.json({ value });
  } catch {
    return NextResponse.json({ value: null });
  }
}
