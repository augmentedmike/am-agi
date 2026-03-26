import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

export type CardState = 'backlog' | 'in-progress' | 'in-review' | 'shipped';
export type CardPriority = 'AI' | 'critical' | 'high' | 'normal' | 'low';

export type WorkLogEntry = { timestamp: string; message: string };
export type Attachment = { path: string; name: string };
export type TokenLogEntry = { iter: number; inputTokens: number; outputTokens: number; cacheRead: number; timestamp: string };
export type ChatRole = 'user' | 'assistant';
export type ChatStatus = 'pending' | 'processing' | 'done' | 'error';

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  state: text('state', { enum: ['backlog', 'in-progress', 'in-review', 'shipped'] }).notNull().default('backlog'),
  priority: text('priority', { enum: ['AI', 'critical', 'high', 'normal', 'low'] }).notNull().default('normal'),
  attachments: text('attachments', { mode: 'json' }).$type<Attachment[]>().notNull().default([]),
  workLog: text('work_log', { mode: 'json' }).$type<WorkLogEntry[]>().notNull().default([]),
  tokenLogs: text('token_logs', { mode: 'json' }).$type<TokenLogEntry[]>().notNull().default([]),
  workDir: text('work_dir'),
  projectId: text('project_id'),
  parentId: text('parent_id'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  inProgressAt: text('in_progress_at'),
  inReviewAt: text('in_review_at'),
  shippedAt: text('shipped_at'),
});

export const iterations = sqliteTable('iterations', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id),
  iterationNumber: integer('iteration_number').notNull(),
  logText: text('log_text').notNull(),
  commitSha: text('commit_sha'),
  createdAt: text('created_at').notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  repoDir: text('repo_dir').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const knowledge = sqliteTable('knowledge', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  embedding: blob('embedding'),  // stored as Float32Array buffer
  source: text('source').notNull(),
  cardId: text('card_id'),
  createdAt: text('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  role: text('role', { enum: ['user', 'assistant'] }).$type<ChatRole>().notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: ['pending', 'processing', 'done', 'error'] }).$type<ChatStatus>().notNull().default('pending'),
  replyToId: text('reply_to_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
