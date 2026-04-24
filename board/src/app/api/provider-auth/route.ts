import { execSync } from 'child_process';
import { NextResponse } from 'next/server';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
<<<<<<< HEAD
 * Detect which provider is configured.
 * Returns "claude" (default) or the value of AM_PROVIDER.
 */
function detectProvider(): string {
=======
 * Detect the configured provider from environment variables.
 * Falls back to "claude" when AM_PROVIDER is unset.
 */
function getProvider(): string {
>>>>>>> 1bd92c5 (make claude code optional, support hermes + qwen3 providers)
  return process.env.AM_PROVIDER || 'claude';
}

/**
<<<<<<< HEAD
 * Check Claude CLI is installed and authenticated.
 */
function checkClaudeAuth(): boolean {
  const claudeBin = process.env.CLAUDE_BIN
    ?? (() => {
=======
 * Check Claude CLI connectivity: binary exists and responds to --version.
 */
function checkClaude(): { authenticated: boolean; provider: string } {
  const claudeBin =
    process.env.CLAUDE_BIN ||
    (() => {
>>>>>>> 1bd92c5 (make claude code optional, support hermes + qwen3 providers)
      try {
        return execSync('which claude 2>/dev/null', { encoding: 'utf8' }).trim();
      } catch {
        return path.join(process.env.HOME ?? '', '.local/bin/claude');
      }
    })();

  try {
    execSync(`"${claudeBin}" --version`, { encoding: 'utf8', timeout: 5000 });
<<<<<<< HEAD
    return true;
  } catch {
    return false;
=======
    return { authenticated: true, provider: 'claude' };
  } catch {
    return { authenticated: false, provider: 'claude' };
>>>>>>> 1bd92c5 (make claude code optional, support hermes + qwen3 providers)
  }
}

/**
<<<<<<< HEAD
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
=======
 * Check OpenAI-compatible provider connectivity: send a lightweight request
 * to the configured base URL.
 */
async function checkOpenAICompatible(provider: string): Promise<{ authenticated: boolean; provider: string }> {
  const baseURL = process.env.AM_BASE_URL;
  const apiKey = process.env.AM_API_KEY;

  if (!baseURL) {
    return { authenticated: false, provider };
  }

  try {
    // Hit the /models endpoint (standard OpenAI-compatible health check)
    const modelsURL = baseURL.replace(/\/+$/, '') + '/models';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(modelsURL, { headers, signal: AbortSignal.timeout(5000) });
    return { authenticated: res.ok, provider };
  } catch {
    // Connection refused / timeout — provider not reachable
    return { authenticated: false, provider };
  }
}

export async function GET() {
  const provider = getProvider();

  if (provider === 'claude' || !provider) {
    return NextResponse.json(checkClaude());
  }

  // For hermes, qwen, or any OpenAI-compatible provider
  const result = await checkOpenAICompatible(provider);
  return NextResponse.json(result);
}
>>>>>>> 1bd92c5 (make claude code optional, support hermes + qwen3 providers)
