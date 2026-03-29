import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { getDb } from '@/db/client';
import { getChatMessage, addChatMessageAttachment } from '@/db/chat';
import { broadcast } from '@/lib/ws-store';
import { homedir } from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expandHome(p: string): string {
  return p.replace(/^~/, homedir());
}

function chatWorkspaceDir(messageId: string): string {
  const base = process.env.WORKSPACES_DIR
    ? expandHome(process.env.WORKSPACES_DIR)
    : join(process.cwd(), '..', 'workspaces');
  return join(base, 'chat', messageId);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();

  const msg = getChatMessage(db, id);
  if (!msg) return NextResponse.json({ error: 'message not found' }, { status: 404 });

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
  const isImage = fileObj.type.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg'].includes(ext);

  const buffer = Buffer.from(await fileObj.arrayBuffer());

  let filePath: string;
  let attachmentPath: string;
  let storedName: string;

  if (isImage) {
    const wsDir = chatWorkspaceDir(id);
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
      await writeFile(filePath, buffer);
    }
    attachmentPath = `/api/media?path=${encodeURIComponent(filePath)}`;
    storedName = destName;
  } else {
    // Non-image files go to public/uploads
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const timestamp = Date.now();
    const safeName = fileObj.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${id}-${timestamp}-${safeName}`;
    filePath = join(uploadsDir, filename);
    await writeFile(filePath, buffer);
    attachmentPath = `/uploads/${filename}`;
    storedName = fileObj.name;
  }

  const updated = addChatMessageAttachment(db, id, { path: attachmentPath, name: storedName, fsPath: filePath });
  if (!updated) return NextResponse.json({ error: 'failed to save attachment' }, { status: 500 });

  try { broadcast({ type: 'chat_message', message: updated }); } catch {}

  return NextResponse.json(updated);
}
