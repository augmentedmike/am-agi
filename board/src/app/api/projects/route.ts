import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import { getDb } from '@/db/client';
import { listProjects, createProject } from '@/db/projects';
import { getSetting } from '@/db/settings';
import { broadcast } from '@/lib/ws-store';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  repoDir: z.string().optional(),
  isTest: z.boolean().optional(),
  githubRepo: z.string().optional(),
  vercelUrl: z.string().optional(),
  templateType: z.string().optional(),
  defaultBranch: z.string().optional(),
});

export async function GET() {
  const { db, sqlite } = getDb();
  return NextResponse.json(listProjects(db));
}

export async function POST(req: NextRequest) {
  const { db, sqlite } = getDb();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const project = createProject(db, parsed.data);
    try { broadcast({ type: 'project_created', project }); } catch {}

    // Clone the repo if githubRepo and repoDir are set
    if (parsed.data.githubRepo && parsed.data.repoDir) {
      const repoDir = parsed.data.repoDir.replace(/^~/, process.env.HOME ?? '');
      if (!fs.existsSync(repoDir)) {
        try {
          const token = getSetting(db, 'github_token');
          const repoSlug = parsed.data.githubRepo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
          const cloneUrl = token
            ? `https://${token}@github.com/${repoSlug}.git`
            : `https://github.com/${repoSlug}.git`;
          const parentDir = repoDir.substring(0, repoDir.lastIndexOf('/'));
          fs.mkdirSync(parentDir, { recursive: true });
          execSync(`git clone "${cloneUrl}" "${repoDir}"`, { timeout: 60000 });
        } catch {
          // Clone failure is non-fatal — project is created, user can clone manually
        }
      }
    }

    return NextResponse.json(project, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'A project with that name already exists.' }, { status: 409 });
    }
    throw err;
  }
}
