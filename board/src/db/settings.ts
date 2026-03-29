import { eq } from 'drizzle-orm';
import { settings } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

type Db = BetterSQLite3Database<typeof schema>;

export type SettingKey =
  | 'github_username'
  | 'github_token'
  | 'github_email'
  | 'workspaces_dir'
  | 'github_repo'
  | 'vercel_url'
  | 'show_am_board'
  | 'hidden_projects'
  | 'work_types';

export const SETTING_DEFAULTS: Record<SettingKey, string> = {
  github_username: '',
  github_token: '',
  github_email: '',
  workspaces_dir: '~/workspaces',
  github_repo: '',
  vercel_url: '',
  show_am_board: 'false',
  hidden_projects: '["am-board-0000-0000-0000-000000000000"]',
  work_types: '[]',
};

export function getSetting(db: Db, key: SettingKey): string {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? SETTING_DEFAULTS[key] ?? '';
}

export function getAllSettings(db: Db): Record<string, string> {
  const rows = db.select().from(settings).all();
  const result: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export function setSetting(db: Db, key: string, value: string): void {
  const now = new Date().toISOString();
  db.insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
    .run();
}

export function deleteSetting(db: Db, key: string): void {
  db.delete(settings).where(eq(settings.key, key)).run();
}
