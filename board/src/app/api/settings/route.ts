import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getAllSettings, setSetting } from '@/db/settings';
import { eq } from 'drizzle-orm';
import { settings as settingsTable } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { db, sqlite } = getDb();
  const all = getAllSettings(db);
  // If show_am_board was never explicitly stored, default to 'true' for mike
  const storedAmBoard = db.select().from(settingsTable).where(eq(settingsTable.key, 'show_am_board')).get();
  if (!storedAmBoard && all.github_username === 'michaeloneal') {
    all.show_am_board = 'true';
  }
  // Migrate show_am_board → hidden_projects if hidden_projects not yet stored
  const storedHiddenProjects = db.select().from(settingsTable).where(eq(settingsTable.key, 'hidden_projects')).get();
  if (!storedHiddenProjects) {
    // Derive from show_am_board: if true, HelloAm! was visible → not hidden
    if (all.show_am_board === 'true') {
      all.hidden_projects = '[]';
    } else {
      all.hidden_projects = '["am-board-0000-0000-0000-000000000000"]';
    }
  }
  // Mask secrets in response
  const safe = {
    ...all,
    github_token: all.github_token ? '***' : '',
    hermes_api_key: all.hermes_api_key ? '***' : '',
    deepseek_api_key: all.deepseek_api_key ? '***' : '',
  };
  return NextResponse.json(safe);
}

export async function PATCH(req: NextRequest) {
  const { db, sqlite } = getDb();
  const body = await req.json() as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') setSetting(db, key, value);
  }
  const all = getAllSettings(db);
  const safe = {
    ...all,
    github_token: all.github_token ? '***' : '',
    hermes_api_key: all.hermes_api_key ? '***' : '',
    deepseek_api_key: all.deepseek_api_key ? '***' : '',
  };
  return NextResponse.json(safe);
}
