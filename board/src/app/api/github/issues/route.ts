import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runMigrations } from '@/db/migrations';
import { getProject } from '@/db/projects';
import { getSetting } from '@/db/settings';
import { getIssues } from '@/lib/github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/github/issues?projectId=<id>
 * Returns open GitHub issues for the project's githubRepo.
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const { db, sqlite } = getDb();
  runMigrations(db, sqlite);

  const project = getProject(db, projectId);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (!project.githubRepo) return NextResponse.json({ issues: [], reason: 'no_repo' });

  const token = getSetting(db, 'github_token');
  if (!token) return NextResponse.json({ error: 'github_token not configured' }, { status: 503 });

  try {
    const issues = await getIssues(token, project.githubRepo);
    return NextResponse.json({ issues });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
