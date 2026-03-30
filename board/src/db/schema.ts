import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

export type CardState = 'backlog' | 'in-progress' | 'in-review' | 'shipped';
export type CardPriority = 'AI' | 'critical' | 'high' | 'normal' | 'low';
export type CardType = 'task' | 'lead' | 'account' | 'candidate';

export type WorkLogEntry = { timestamp: string; message: string };
export type Attachment = { path: string; name: string; fsPath?: string };
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
  version: text('version'),
  deps: text('deps', { mode: 'json' }).$type<string[]>().notNull().default([]),
  cardType: text('card_type').notNull().default('task'),
  entityFields: text('entity_fields', { mode: 'json' }).$type<Record<string, string | number | null>>().notNull().default({}),
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
  versioned: integer('versioned', { mode: 'boolean' }).notNull().default(false),
  isTest: integer('is_test', { mode: 'boolean' }).notNull().default(false),
  prodPort: integer('prod_port'),
  devPort: integer('dev_port'),
  demoUrl: text('demo_url'),
  githubRepo: text('github_repo'),
  vercelUrl: text('vercel_url'),
  currentVersion: text('current_version'),
  templateType: text('template_type'),
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
  projectId: text('project_id'),
  attachments: text('attachments', { mode: 'json' }).$type<Attachment[]>().notNull().default([]),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type MemoryTerm = 'st' | 'lt';

export type TeamRole = 'owner' | 'manager' | 'expert' | 'tester';

// CRM / Rolodex
export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  tags: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactMemory = {
  id: string;
  contactId: string;
  content: string;
  createdAt: string;
};

export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  jobTitle: text('job_title').notNull().default(''),
  role: text('role', { enum: ['owner', 'manager', 'expert', 'tester'] }).$type<TeamRole>().notNull().default('tester'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type ContactKind = 'person' | 'company';

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['person', 'company'] }).$type<ContactKind>().notNull().default('person'),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  role: text('role'),
  source: text('source'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  notes: text('notes'),
  avatarUrl: text('avatar_url'),
  linkedMemoryIds: text('linked_memory_ids', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const contactMemoryLinks = sqliteTable('contact_memory_links', {
  id: text('id').primaryKey(),
  contactId: text('contact_id').notNull().references(() => contacts.id),
  memoryId: text('memory_id').notNull(),
  createdAt: text('created_at').notNull(),
});

// Pipeline types
export type Pipeline = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineStage = {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  color: string | null;
  isTerminal: boolean;
  createdAt: string;
};

export type PipelineEntry = {
  id: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  createdAt: string;
  updatedAt: string;
};

export type StageTransition = {
  id: string;
  entryId: string;
  fromStageId: string | null;
  toStageId: string;
  transitionedAt: string;
};

export const cardDependencies = sqliteTable('card_dependencies', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id),
  dependsOnId: text('depends_on_id').notNull().references(() => cards.id),
  createdAt: text('created_at').notNull(),
});
