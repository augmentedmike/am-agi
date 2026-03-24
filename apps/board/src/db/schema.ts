import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

export type CardState = 'backlog' | 'in-progress' | 'in-review' | 'shipped' | 'archived';
export type CardPriority = 'critical' | 'high' | 'normal' | 'low';

export type WorkLogEntry = { timestamp: string; message: string };
export type Attachment = { path: string; name: string };

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  state: text('state', { enum: ['backlog', 'in-progress', 'in-review', 'shipped', 'archived'] }).notNull().default('backlog'),
  priority: text('priority', { enum: ['critical', 'high', 'normal', 'low'] }).notNull().default('normal'),
  attachments: text('attachments', { mode: 'json' }).$type<Attachment[]>().notNull().default([]),
  workLog: text('work_log', { mode: 'json' }).$type<WorkLogEntry[]>().notNull().default([]),
  workDir: text('work_dir'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const iterations = sqliteTable('iterations', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id),
  iterationNumber: integer('iteration_number').notNull(),
  logText: text('log_text').notNull(),
  commitSha: text('commit_sha'),
  createdAt: text('created_at').notNull(),
});

export const knowledge = sqliteTable('knowledge', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  embedding: blob('embedding'),  // stored as Float32Array buffer
  source: text('source').notNull(),
  cardId: text('card_id'),
  createdAt: text('created_at').notNull(),
});
