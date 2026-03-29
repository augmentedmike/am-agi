import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { getDb } from '@/db/client';
import { getCard, updateCard } from '@/db/cards';
import { broadcast } from '@/lib/ws-store';
import { homedir } from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expandHome(p: string): string {
  return p.replace(/^~/, homedir());
}

/** Return the absolute workspaces/cards/<cardId> directory. */
function cardWorkspaceDir(cardId: string): string {
  const base = process.env.WORKSPACES_DIR
    ? expandHome(process.env.WORKSPACES_DIR)
    : join(process.cwd(), '..', 'workspaces');
  return join(base, 'cards', cardId);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();

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

  if ((file as File).type.startsWith('video/')) {
    return NextResponse.json({ error: 'video files are not supported' }, { status: 415 });
  }

  const fileObj = file as File;
  const ext = extname(fileObj.name).toLowerCase();
  const isMarkdown = ext === '.md';
  const isImage = fileObj.type.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg'].includes(ext);

  const buffer = Buffer.from(await fileObj.arrayBuffer());

  let filePath: string;
  let attachmentPath: string;
  let storedName: string;

  if (isMarkdown) {
    // Save to workspaces/cards/<cardId>/<filename>
    const wsDir = cardWorkspaceDir(id);
    await mkdir(wsDir, { recursive: true });
    const safeName = fileObj.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    filePath = join(wsDir, safeName);
    await writeFile(filePath, buffer);
    attachmentPath = filePath; // absolute path — not a web path
    storedName = safeName;
  } else if (isImage) {
    // Save to workspaces/cards/<cardId>/media/<basename>.jpg using sharp
    const wsDir = cardWorkspaceDir(id);
    const mediaDir = join(wsDir, 'media');
    await mkdir(mediaDir, { recursive: true });
    const baseName = basename(fileObj.name, ext).replace(/[^a-zA-Z0-9._-]/g, '_') || 'image';
    const timestamp = Date.now();
    const destName = `${id}-${timestamp}-${baseName}.jpg`;
    filePath = join(mediaDir, destName);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sharp = require('sharp');
      await sharp(buffer).jpeg({ quality: 85 }).toFile(filePath);
    } catch {
      // sharp unavailable — fall back to writing buffer as-is (will not be a valid JPEG for non-jpeg input, but best effort)
      await writeFile(filePath, buffer);
    }
    attachmentPath = `/api/media?path=${encodeURIComponent(filePath)}`;
    storedName = destName;
  } else {
    // Other files: save to board/public/uploads (existing behaviour)
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const timestamp = Date.now();
    const strippedName = fileObj.name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d{13}-/, '');
    const safeName = strippedName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${id}-${timestamp}-${safeName}`;
    filePath = join(uploadsDir, filename);
    await writeFile(filePath, buffer);
    attachmentPath = `/uploads/${filename}`;
    storedName = strippedName;
  }

  const updated = updateCard(db, id, {
    attachment: { path: attachmentPath, name: storedName, fsPath: filePath },
  });

  if (!updated) return NextResponse.json({ error: 'failed to save attachment' }, { status: 500 });

  broadcast({ type: 'card_updated', card: updated });

  return NextResponse.json(updated);
}
