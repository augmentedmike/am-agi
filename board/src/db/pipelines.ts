import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Pipeline, PipelineStage, PipelineEntry, StageTransition } from './schema';

type Db = { sqlite: InstanceType<typeof Database> };

// ── row mappers ──────────────────────────────────────────────────────────────

function rowToPipeline(r: Record<string, unknown>): Pipeline {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description ?? null) as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToStage(r: Record<string, unknown>): PipelineStage {
  return {
    id: r.id as string,
    pipelineId: r.pipeline_id as string,
    name: r.name as string,
    position: r.position as number,
    color: (r.color ?? null) as string | null,
    isTerminal: Boolean(r.is_terminal),
    createdAt: r.created_at as string,
  };
}

function rowToEntry(r: Record<string, unknown>): PipelineEntry {
  return {
    id: r.id as string,
    contactId: r.contact_id as string,
    pipelineId: r.pipeline_id as string,
    stageId: r.stage_id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ── pipelines ────────────────────────────────────────────────────────────────

export function listPipelines({ sqlite }: Db): Pipeline[] {
  const rows = sqlite.prepare('SELECT * FROM pipelines ORDER BY created_at ASC').all() as Record<string, unknown>[];
  return rows.map(rowToPipeline);
}

export function getPipeline({ sqlite }: Db, id: string): Pipeline | undefined {
  const row = sqlite.prepare('SELECT * FROM pipelines WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToPipeline(row) : undefined;
}

export function createPipeline({ sqlite }: Db, input: { name: string; description?: string | null }): Pipeline {
  const id = randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(
    'INSERT INTO pipelines (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.name, input.description ?? null, now, now);
  return getPipeline({ sqlite }, id)!;
}

export function updatePipeline({ sqlite }: Db, id: string, input: { name?: string; description?: string | null }): Pipeline | undefined {
  const existing = getPipeline({ sqlite }, id);
  if (!existing) return undefined;
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if ('description' in input) { fields.push('description = ?'); values.push(input.description ?? null); }
  if (fields.length === 0) return existing;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  sqlite.prepare(`UPDATE pipelines SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getPipeline({ sqlite }, id);
}

export function deletePipeline({ sqlite }: Db, id: string): void {
  sqlite.prepare('DELETE FROM pipelines WHERE id = ?').run(id);
}

// ── stages ───────────────────────────────────────────────────────────────────

export function listStages({ sqlite }: Db, pipelineId: string): PipelineStage[] {
  const rows = sqlite.prepare(
    'SELECT * FROM pipeline_stages WHERE pipeline_id = ? ORDER BY position ASC'
  ).all(pipelineId) as Record<string, unknown>[];
  return rows.map(rowToStage);
}

export function getStage({ sqlite }: Db, id: string): PipelineStage | undefined {
  const row = sqlite.prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToStage(row) : undefined;
}

export function createStage({ sqlite }: Db, input: { pipelineId: string; name: string; color?: string | null; isTerminal?: boolean }): PipelineStage {
  const id = randomUUID();
  const now = new Date().toISOString();
  // position = max existing + 1
  const maxRow = sqlite.prepare('SELECT MAX(position) as m FROM pipeline_stages WHERE pipeline_id = ?').get(input.pipelineId) as { m: number | null };
  const position = (maxRow.m ?? -1) + 1;
  sqlite.prepare(
    'INSERT INTO pipeline_stages (id, pipeline_id, name, position, color, is_terminal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.pipelineId, input.name, position, input.color ?? null, input.isTerminal ? 1 : 0, now);
  return getStage({ sqlite }, id)!;
}

export function updateStage({ sqlite }: Db, id: string, input: { name?: string; color?: string | null; position?: number; isTerminal?: boolean }): PipelineStage | undefined {
  const existing = getStage({ sqlite }, id);
  if (!existing) return undefined;
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if ('color' in input) { fields.push('color = ?'); values.push(input.color ?? null); }
  if (input.position !== undefined) { fields.push('position = ?'); values.push(input.position); }
  if (input.isTerminal !== undefined) { fields.push('is_terminal = ?'); values.push(input.isTerminal ? 1 : 0); }
  if (fields.length === 0) return existing;
  values.push(id);
  sqlite.prepare(`UPDATE pipeline_stages SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getStage({ sqlite }, id);
}

export function deleteStage({ sqlite }: Db, id: string): void {
  sqlite.prepare('DELETE FROM pipeline_stages WHERE id = ?').run(id);
}

export function getEntriesInStage({ sqlite }: Db, stageId: string): number {
  const row = sqlite.prepare('SELECT COUNT(*) as c FROM pipeline_entries WHERE stage_id = ?').get(stageId) as { c: number };
  return row.c;
}

// ── entries ──────────────────────────────────────────────────────────────────

export type EntryWithContact = PipelineEntry & {
  contact: {
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
};

export function listEntries({ sqlite }: Db, pipelineId: string): EntryWithContact[] {
  const rows = sqlite.prepare(`
    SELECT
      pe.id, pe.contact_id, pe.pipeline_id, pe.stage_id, pe.created_at, pe.updated_at,
      c.name as c_name, c.email as c_email, c.phone as c_phone, c.company as c_company,
      c.title as c_title, c.tags as c_tags, c.avatar_url as c_avatar_url,
      c.created_at as c_created_at, c.updated_at as c_updated_at
    FROM pipeline_entries pe
    JOIN contacts c ON c.id = pe.contact_id
    WHERE pe.pipeline_id = ?
    ORDER BY pe.created_at ASC
  `).all(pipelineId) as Record<string, unknown>[];

  return rows.map(r => ({
    id: r.id as string,
    contactId: r.contact_id as string,
    pipelineId: r.pipeline_id as string,
    stageId: r.stage_id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    contact: {
      id: r.contact_id as string,
      name: r.c_name as string,
      email: (r.c_email ?? null) as string | null,
      phone: (r.c_phone ?? null) as string | null,
      company: (r.c_company ?? null) as string | null,
      title: (r.c_title ?? null) as string | null,
      tags: (r.c_tags ?? null) as string | null,
      avatarUrl: (r.c_avatar_url ?? null) as string | null,
      createdAt: r.c_created_at as string,
      updatedAt: r.c_updated_at as string,
    },
  }));
}

export function getEntry({ sqlite }: Db, entryId: string): PipelineEntry | undefined {
  const row = sqlite.prepare('SELECT * FROM pipeline_entries WHERE id = ?').get(entryId) as Record<string, unknown> | undefined;
  return row ? rowToEntry(row) : undefined;
}

export function addContactToPipeline({ sqlite }: Db, input: { contactId: string; pipelineId: string; stageId: string }): PipelineEntry {
  const id = randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(
    'INSERT INTO pipeline_entries (id, contact_id, pipeline_id, stage_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.contactId, input.pipelineId, input.stageId, now, now);
  // Record initial transition (from_stage_id = NULL)
  recordTransition({ sqlite }, id, null, input.stageId);
  return getEntry({ sqlite }, id)!;
}

export function moveEntry({ sqlite }: Db, entryId: string, stageId: string): PipelineEntry | undefined {
  const existing = getEntry({ sqlite }, entryId);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  const fromStageId = existing.stageId;
  sqlite.prepare('UPDATE pipeline_entries SET stage_id = ?, updated_at = ? WHERE id = ?').run(stageId, now, entryId);
  recordTransition({ sqlite }, entryId, fromStageId, stageId);
  return getEntry({ sqlite }, entryId);
}

export function removeEntry({ sqlite }: Db, entryId: string): void {
  sqlite.prepare('DELETE FROM pipeline_entries WHERE id = ?').run(entryId);
}

export function recordTransition({ sqlite }: Db, entryId: string, fromStageId: string | null, toStageId: string): void {
  const id = randomUUID();
  sqlite.prepare(
    'INSERT INTO stage_transitions (id, entry_id, from_stage_id, to_stage_id, transitioned_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, entryId, fromStageId, toStageId, new Date().toISOString());
}

// ── contact pipeline membership ──────────────────────────────────────────────

export function getContactPipelineEntries({ sqlite }: Db, contactId: string): (PipelineEntry & { pipelineName: string; stageName: string })[] {
  const rows = sqlite.prepare(`
    SELECT pe.*, p.name as pipeline_name, ps.name as stage_name
    FROM pipeline_entries pe
    JOIN pipelines p ON p.id = pe.pipeline_id
    JOIN pipeline_stages ps ON ps.id = pe.stage_id
    WHERE pe.contact_id = ?
    ORDER BY pe.created_at ASC
  `).all(contactId) as Record<string, unknown>[];
  return rows.map(r => ({
    ...rowToEntry(r),
    pipelineName: r.pipeline_name as string,
    stageName: r.stage_name as string,
  }));
}
