import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import JSZip from 'jszip';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, sqlite } = getDb();

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

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  const backupJsonFile = zip.file('backup.json');
  if (!backupJsonFile) return NextResponse.json({ error: 'Invalid backup: missing backup.json' }, { status: 400 });

  let backup: Record<string, unknown>;
  try {
    backup = JSON.parse(await backupJsonFile.async('string'));
  } catch {
    return NextResponse.json({ error: 'Invalid backup: malformed JSON' }, { status: 400 });
  }

  if (backup.version !== '1') {
    return NextResponse.json({ error: 'Unsupported backup version' }, { status: 400 });
  }

  const project = backup.project as Record<string, unknown>;
  const cards = (backup.cards as Record<string, unknown>[]) ?? [];
  const iterations = (backup.iterations as Record<string, unknown>[]) ?? [];
  const attachmentManifest = (backup.attachmentManifest as Array<{ cardId: string; path: string; name: string }>) ?? [];
  const workspaceManifest = (backup.workspaceManifest as string[]) ?? [];

  // Upsert project
  sqlite.prepare(`
    INSERT OR REPLACE INTO projects (id, name, repo_dir, versioned, is_test, github_repo, vercel_url, current_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    project.id, project.name, project.repoDir, project.versioned ? 1 : 0,
    project.isTest ? 1 : 0, project.githubRepo ?? null, project.vercelUrl ?? null,
    project.currentVersion ?? null, project.createdAt, project.updatedAt
  );

  // Upsert cards
  for (const card of cards) {
    sqlite.prepare(`
      INSERT OR REPLACE INTO cards (id, title, state, priority, attachments, work_log, token_logs, work_dir, project_id, parent_id, version, archived, created_at, updated_at, in_progress_at, in_review_at, shipped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      card.id, card.title, card.state, card.priority,
      JSON.stringify(card.attachments ?? []),
      JSON.stringify(card.workLog ?? []),
      JSON.stringify(card.tokenLogs ?? []),
      card.workDir ?? null,
      String(id), // use the URL project id
      card.parentId ?? null,
      card.version ?? null,
      card.archived ? 1 : 0,
      card.createdAt, card.updatedAt,
      card.inProgressAt ?? null, card.inReviewAt ?? null, card.shippedAt ?? null
    );
  }

  // Upsert iterations
  for (const iter of iterations) {
    sqlite.prepare(`
      INSERT OR REPLACE INTO iterations (id, card_id, iteration_number, log_text, commit_sha, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(iter.id, iter.cardId ?? iter.card_id, iter.iterationNumber ?? iter.iteration_number, iter.logText ?? iter.log_text, iter.commitSha ?? iter.commit_sha ?? null, iter.createdAt ?? iter.created_at);
  }

  // Restore attachment files
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  for (const att of attachmentManifest) {
    const zipName = `uploads/${att.path.replace(/^\/uploads\//, '')}`;
    const zipEntry = zip.file(zipName);
    if (zipEntry) {
      const destPath = join(process.cwd(), 'public', att.path);
      try {
        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, await zipEntry.async('nodebuffer'));
      } catch {}
    }
  }

  // Restore workspace files
  const workspacesDir = process.env.WORKSPACES_DIR ?? join(process.cwd(), '..', 'workspaces');
  const projectWorkspaceDir = join(workspacesDir, String(project.name));
  for (const relPath of workspaceManifest) {
    const zipEntry = zip.file(`workspace/${relPath}`);
    if (zipEntry) {
      const destPath = join(projectWorkspaceDir, relPath);
      try {
        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, await zipEntry.async('nodebuffer'));
      } catch {}
    }
  }

  return NextResponse.json({ ok: true });
}
