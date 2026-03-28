import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';
import { listCards } from '@/db/cards';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function addDirToZip(zip: JSZip, dir: string, prefix: string) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const zipPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      addDirToZip(zip, fullPath, zipPath);
    } else {
      try {
        zip.file(zipPath, readFileSync(fullPath));
      } catch {}
    }
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const cards = listCards(db, { projectId: id, all: true });

  // Get iterations for all cards
  const cardIds = cards.map(c => c.id);
  const iterations = cardIds.length > 0
    ? sqlite.prepare(
        `SELECT * FROM iterations WHERE card_id IN (${cardIds.map(() => '?').join(',')}) ORDER BY iteration_number ASC`
      ).all(...cardIds)
    : [];

  // Get knowledge for this project (by card)
  const knowledge = cardIds.length > 0
    ? sqlite.prepare(
        `SELECT id, content, source, card_id, created_at FROM knowledge WHERE card_id IN (${cardIds.map(() => '?').join(',')})`
      ).all(...cardIds)
    : [];

  // Get settings
  const settings = sqlite.prepare('SELECT key, value FROM settings').all();

  const exportedAt = new Date().toISOString();
  const slug = slugify(project.name);
  const dateStr = exportedAt.slice(0, 10);
  const filename = `${slug}-backup-${dateStr}.zip`;

  const zip = new JSZip();

  // Build attachment manifest
  const attachmentManifest: Array<{ cardId: string; path: string; name: string; fsPath?: string }> = [];
  for (const card of cards) {
    for (const att of card.attachments ?? []) {
      attachmentManifest.push({ cardId: card.id, path: att.path, name: att.name, fsPath: att.fsPath });
      // Include attachment file if it exists on disk
      const fsPath = att.fsPath;
      if (fsPath && existsSync(fsPath)) {
        const zipAttPath = `uploads/${att.path.replace(/^\/uploads\//, '')}`;
        try { zip.file(zipAttPath, readFileSync(fsPath)); } catch {}
      } else if (att.path.startsWith('/uploads/')) {
        const localPath = join(process.cwd(), 'public', att.path);
        if (existsSync(localPath)) {
          try { zip.file(`uploads/${att.path.replace(/^\/uploads\//, '')}`, readFileSync(localPath)); } catch {}
        }
      }
    }
  }

  // Include workspace docs
  const workspacesDir = process.env.WORKSPACES_DIR ?? join(process.cwd(), '..', 'workspaces');
  const projectWorkspaceDir = join(workspacesDir, project.name);
  let workspaceManifest: string[] = [];
  if (existsSync(projectWorkspaceDir)) {
    const collectPaths = (dir: string): string[] => {
      const result: string[] = [];
      try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) result.push(...collectPaths(full));
          else result.push(full);
        }
      } catch {}
      return result;
    };
    const files = collectPaths(projectWorkspaceDir);
    for (const f of files) {
      const rel = relative(projectWorkspaceDir, f);
      workspaceManifest.push(rel);
      try { zip.file(`workspace/${rel}`, readFileSync(f)); } catch {}
    }
  }

  const backup = {
    version: '1',
    exportedAt,
    project,
    cards,
    iterations,
    knowledge,
    settings,
    attachmentManifest,
    workspaceManifest,
  };

  zip.file('backup.json', JSON.stringify(backup, null, 2));

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
