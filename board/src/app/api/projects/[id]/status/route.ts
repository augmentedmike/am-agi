import { NextRequest, NextResponse } from 'next/server';
import { runningProcesses } from '@/lib/start-project';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

/**
 * GET /api/projects/[id]/status — returns whether a tracked dev server is
 * currently running for this project, plus its URL/port/pid for the UI to
 * link to. Stale tracker entries (PID died externally) are pruned on read.
 *
 * The returned `url` honors the project's `devUrl` override (set in project
 * settings) when present; otherwise falls back to `http://localhost:<port>`.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = runningProcesses.get(id);
  if (!entry) return NextResponse.json({ running: false });
  if (!isAlive(entry.pid)) {
    runningProcesses.delete(id);
    return NextResponse.json({ running: false });
  }
  const { db } = getDb();
  const project = getProject(db, id);
  const url = project?.devUrl?.trim() || `http://localhost:${entry.port}`;
  return NextResponse.json({
    running: true,
    pid: entry.pid,
    port: entry.port,
    url,
    startedAt: entry.startedAt,
  });
}
