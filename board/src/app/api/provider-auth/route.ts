import { execSync } from 'child_process';
import { NextResponse } from 'next/server';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Detect which provider is configured.
 * Returns "claude" (default) or the value of AM_PROVIDER.
 */
function detectProvider(): string {
  return process.env.AM_PROVIDER || 'claude';
}

/**
 * Check Claude CLI is installed and authenticated.
 */
function checkClaudeAuth(): boolean {
  const claudeBin = process.env.CLAUDE_BIN
    ?? (() => {
      try {
        return execSync('which claude 2>/dev/null', { encoding: 'utf8' }).trim();
      } catch {
        return path.join(process.env.HOME ?? '', '.local/bin/claude');
      }
    })();

  try {
    execSync(`"${claudeBin}" --version`, { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check OpenAI-compatible provider is configured.
 * Requires AM_API_KEY to be set.
 */
function checkOpenAIAuth(): boolean {
  return !!process.env.AM_API_KEY;
}

export async function GET() {
  const provider = detectProvider();

  let authenticated: boolean;
  if (provider === 'claude') {
    authenticated = checkClaudeAuth();
  } else {
    authenticated = checkOpenAIAuth();
  }

  return NextResponse.json({ authenticated, provider });
}

/**
 * POST — accept an API key from the onboarding UI.
 * Sets AM_API_KEY in the process env (persists for this server lifetime).
 */
export async function POST(request: Request) {
  const provider = detectProvider();

  if (provider === 'claude') {
    return NextResponse.json(
      { authenticated: false, provider, error: 'Claude provider uses CLI auth, not API key' },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const apiKey = body?.apiKey;
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { authenticated: false, provider, error: 'Missing apiKey in request body' },
        { status: 400 },
      );
    }

    // Store the key in process env for this server lifetime
    process.env.AM_API_KEY = apiKey.trim();

    return NextResponse.json({ authenticated: true, provider });
  } catch {
    return NextResponse.json(
      { authenticated: false, provider, error: 'Invalid request' },
      { status: 400 },
    );
  }
}
