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
  | 'work_types'
  | 'smtp_host'
  | 'smtp_port'
  | 'smtp_user'
  | 'smtp_pass'
  | 'smtp_from'
  | 'smtp_secure'
  | 'support_webhook_secret'
  | 'support_routing_rules'
  | 'prompt_backlog'
  | 'prompt_in_progress'
  | 'prompt_in_review'
  | 'prompt_shipped'
  | 'gate_to_in_progress'
  | 'gate_to_in_review'
  | 'gate_to_shipped'
  | 'gate_back_to_in_progress';

export const SETTING_DEFAULTS: Record<SettingKey, string> = {
  github_username: '',
  github_token: '',
  github_email: '',
  workspaces_dir: '~/am/workspaces',
  github_repo: '',
  vercel_url: '',
  show_am_board: 'false',
  hidden_projects: '["am-board-0000-0000-0000-000000000000"]',
  work_types: '[]',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from: '',
  smtp_secure: 'false',
  support_webhook_secret: '',
  support_routing_rules: '[]',
  prompt_backlog: 'Research requirements, gather context, and write acceptance criteria. Understand the full scope before implementation. Goal: leave backlog with a clear criteria.md and no open questions.',
  prompt_in_progress: 'Implement the solution. Write code, create files, make changes. Every acceptance criterion in criteria.md must have a corresponding implementation. No half-finished work.',
  prompt_in_review: 'Verify all acceptance criteria are met. Run tests. Check edge cases, regressions, and security. Nothing ships without every criterion confirmed.',
  prompt_shipped: 'Task is complete. Run post-ship hooks, update docs, close related issues, tag the release if versioned.',
  gate_to_in_progress: 'criteria.md written and complete. All requirements understood. No open questions remaining.',
  gate_to_in_review: 'All acceptance criteria from criteria.md have a corresponding implementation. No TODOs or placeholders.',
  gate_to_shipped: 'All criteria verified and passing. Tests pass. Reviewer sign-off obtained.',
  gate_back_to_in_progress: 'Verification failed — at least one criterion is not met. Log the failure reason before resuming work.',
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
