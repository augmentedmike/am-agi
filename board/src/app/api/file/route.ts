import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Allowed text extensions for the inline viewer
const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
  '.sh', '.bash', '.zsh', '.env', '.toml', '.ini', '.cfg', '.conf',
  '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.css',
  '.html', '.xml', '.sql', '.log',
]);

function isAllowedPath(filePath: string): boolean {
  // Must be an absolute path
  if (!path.isAbsolute(filePath)) return false;
  // Resolve to prevent directory traversal
  const resolved = path.resolve(filePath);
  // Must stay within HOME or common workspace roots
  const home = process.env.HOME ?? '/Users';
  return resolved.startsWith(home) || resolved.startsWith('/tmp');
}

// GET /api/file?path=/absolute/path/to/file.md
export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'path required' }, { status: 400 });
  }

  if (!isAllowedPath(filePath)) {
    return NextResponse.json({ error: 'path not allowed' }, { status: 403 });
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'file type not supported for inline viewing' }, { status: 415 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'file not found' }, { status: 404 });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: 'failed to read file' }, { status: 500 });
  }
}
