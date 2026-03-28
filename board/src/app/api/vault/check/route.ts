import { execSync } from 'child_process';
import { NextResponse } from 'next/server';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AM_ROOT = path.resolve(process.cwd(), '..');
const VAULT_BIN = path.join(AM_ROOT, 'bin', 'vault');

export async function GET() {
  try {
    execSync(`${VAULT_BIN} check`, { encoding: 'utf8' });
    return NextResponse.json({ ready: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ready: false, reason: msg });
  }
}
