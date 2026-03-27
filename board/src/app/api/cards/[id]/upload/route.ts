import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getCard, updateCard } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);

  const card = getCard(db, id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid multipart/form-data' }, { status: 400 });
  }
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file field required' }, { status: 400 });
  }

  if (file.type.startsWith('video/')) {
    return NextResponse.json({ error: 'video files are not supported' }, { status: 415 });
  }

  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDir, { recursive: true });

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${id}-${timestamp}-${safeName}`;
  const filePath = join(uploadsDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const attachmentPath = `/uploads/${filename}`;
  const updated = updateCard(db, id, {
    attachment: { path: attachmentPath, name: file.name, fsPath: filePath },
  });

  if (!updated) return NextResponse.json({ error: 'failed to save attachment' }, { status: 500 });

  broadcast({ type: 'card_updated', card: updated });

  return NextResponse.json(updated);
}
