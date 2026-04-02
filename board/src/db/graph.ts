import * as schema from './schema';
import { randomUUID } from 'crypto';

type SQLite = import('better-sqlite3').Database;

export function createEntity(
  sqlite: SQLite,
  data: { type: string; name: string; summary?: string; aliases?: string[]; properties?: Record<string, unknown>; confidence?: number; source?: string }
): schema.Entity {
  const id = randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO entities (id, type, name, aliases, summary, properties, confidence, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.type,
    data.name,
    JSON.stringify(data.aliases ?? []),
    data.summary ?? null,
    JSON.stringify(data.properties ?? {}),
    data.confidence ?? 100,
    data.source ?? null,
    now,
    now
  );
  return getEntityById(sqlite, id)!;
}

export function getEntityById(sqlite: SQLite, id: string): schema.Entity | undefined {
  const row = sqlite.prepare('SELECT * FROM entities WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return parseEntity(row);
}

export function updateEntity(
  sqlite: SQLite,
  id: string,
  data: Partial<{ name: string; summary: string | null; aliases: string[]; properties: Record<string, unknown>; confidence: number }>
): schema.Entity | undefined {
  const existing = getEntityById(sqlite, id);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.summary !== undefined) { fields.push('summary = ?'); values.push(data.summary); }
  if (data.aliases !== undefined) { fields.push('aliases = ?'); values.push(JSON.stringify(data.aliases)); }
  if (data.properties !== undefined) { fields.push('properties = ?'); values.push(JSON.stringify(data.properties)); }
  if (data.confidence !== undefined) { fields.push('confidence = ?'); values.push(data.confidence); }
  if (fields.length === 0) return existing;
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);
  sqlite.prepare(`UPDATE entities SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getEntityById(sqlite, id);
}

export function deleteEntity(sqlite: SQLite, id: string): boolean {
  const info = sqlite.prepare('DELETE FROM entities WHERE id = ?').run(id);
  return info.changes > 0;
}

export function searchEntities(sqlite: SQLite, query: string, type?: string): schema.Entity[] {
  const sql = `SELECT e.* FROM entities e JOIN entities_fts fts ON e.rowid = fts.rowid WHERE entities_fts MATCH ?${type ? ' AND e.type = ?' : ''} ORDER BY rank`;
  const rows = (type
    ? sqlite.prepare(sql).all(query + '*', type)
    : sqlite.prepare(sql).all(query + '*')) as Record<string, unknown>[];
  return rows.map(parseEntity);
}

export function createRelation(
  sqlite: SQLite,
  data: { fromId: string; toId: string; relation: string; weight?: number; properties?: Record<string, unknown>; source?: string }
): schema.Relation {
  const id = randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO relations (id, from_id, to_id, relation, weight, properties, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.fromId,
    data.toId,
    data.relation,
    data.weight ?? 1,
    JSON.stringify(data.properties ?? {}),
    data.source ?? null,
    now
  );
  return getRelationById(sqlite, id)!;
}

export function getRelationById(sqlite: SQLite, id: string): schema.Relation | undefined {
  const row = sqlite.prepare('SELECT * FROM relations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return parseRelation(row);
}

export function deleteRelation(sqlite: SQLite, id: string): boolean {
  const info = sqlite.prepare('DELETE FROM relations WHERE id = ?').run(id);
  return info.changes > 0;
}

export function getNeighbors(sqlite: SQLite, id: string): Array<{ entity: schema.Entity; relation: string; direction: 'outgoing' | 'incoming'; relationId: string; weight: number }> {
  const outgoing = sqlite.prepare(`
    SELECT e.*, r.id as rel_id, r.relation as rel_type, r.weight as rel_weight
    FROM relations r JOIN entities e ON e.id = r.to_id
    WHERE r.from_id = ?
  `).all(id) as Record<string, unknown>[];

  const incoming = sqlite.prepare(`
    SELECT e.*, r.id as rel_id, r.relation as rel_type, r.weight as rel_weight
    FROM relations r JOIN entities e ON e.id = r.from_id
    WHERE r.to_id = ?
  `).all(id) as Record<string, unknown>[];

  return [
    ...outgoing.map(row => ({
      entity: parseEntity(row),
      relation: row.rel_type as string,
      direction: 'outgoing' as const,
      relationId: row.rel_id as string,
      weight: row.rel_weight as number,
    })),
    ...incoming.map(row => ({
      entity: parseEntity(row),
      relation: row.rel_type as string,
      direction: 'incoming' as const,
      relationId: row.rel_id as string,
      weight: row.rel_weight as number,
    })),
  ];
}

function parseEntity(row: Record<string, unknown>): schema.Entity {
  return {
    id: row.id as string,
    type: row.type as string,
    name: row.name as string,
    aliases: typeof row.aliases === 'string' ? JSON.parse(row.aliases) : (row.aliases as string[] ?? []),
    summary: row.summary as string | null,
    properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : (row.properties as Record<string, unknown> ?? {}),
    confidence: row.confidence as number,
    source: row.source as string | null,
    embedding: row.embedding as Buffer | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function parseRelation(row: Record<string, unknown>): schema.Relation {
  return {
    id: row.id as string,
    fromId: row.from_id as string,
    toId: row.to_id as string,
    relation: row.relation as string,
    weight: row.weight as number,
    properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : (row.properties as Record<string, unknown> ?? {}),
    source: row.source as string | null,
    createdAt: row.created_at as string,
  };
}
