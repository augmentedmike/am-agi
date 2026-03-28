import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';
import { lookup } from 'mime-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string[] }> }
) {
  const { filename } = await params;
  const safeName = filename.map(s => s.replace(/\.\./g, '')).join('/');
  const filePath = join(process.cwd(), 'public', 'uploads', safeName);

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(filePath);
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  if (!stat.isFile()) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const mimeType = lookup(safeName) || 'application/octet-stream';
  const stream = createReadStream(filePath);
  // @ts-expect-error ReadStream is compatible with ReadableStream for Response
  return new NextResponse(stream, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
