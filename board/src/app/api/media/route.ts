import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { homedir } from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_EXTS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

const ALLOWED_ROOTS = [homedir(), '/tmp'];

function isAllowedPath(absPath: string): boolean {
  const normalized = absPath.replace(/\.\./g, '');
  // Reject if normalization changed the path (traversal attempt)
  if (normalized !== absPath) return false;
  return ALLOWED_ROOTS.some((root) => absPath.startsWith(root + '/') || absPath === root);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawPath = searchParams.get('path');

  if (!rawPath) {
    return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
  }

  const absPath = decodeURIComponent(rawPath);

  // Path traversal protection
  if (!isAllowedPath(absPath)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Extension validation — images only
  const ext = extname(absPath).toLowerCase();
  const contentType = IMAGE_EXTS[ext];
  if (!contentType) {
    return NextResponse.json({ error: 'unsupported media type' }, { status: 415 });
  }

  try {
    const data = await readFile(absPath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
