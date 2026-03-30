import { execSync } from 'child_process';
import { NextResponse } from 'next/server';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function findClaude(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  try {
    const found = execSync('which claude 2>/dev/null', { encoding: 'utf8' }).trim();
    if (found) return found;
  } catch {}
  return path.join(process.env.HOME ?? '', '.local/bin/claude');
}

const CLAUDE_BIN = findClaude();

export async function GET() {
  try {
    execSync(`"${CLAUDE_BIN}" --version`, { encoding: 'utf8', timeout: 5000 });
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
