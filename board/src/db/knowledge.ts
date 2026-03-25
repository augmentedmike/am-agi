import { knowledge } from './schema';
import { eq } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export function storeKnowledge(
  db: Db,
  sqlite: import('better-sqlite3').Database,
  input: { content: string; embedding: number[]; source: string; cardId?: string }
) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const embeddingBuffer = Buffer.from(new Float32Array(input.embedding).buffer);
  db.insert(knowledge).values({
    id,
    content: input.content,
    embedding: embeddingBuffer,
    source: input.source,
    cardId: input.cardId ?? null,
    createdAt: now,
  }).run();
  return id;
}

export function searchKnowledge(
  db: Db,
  queryEmbedding: number[],
  limit = 10
): Array<{ id: string; content: string; source: string; cardId: string | null; similarity: number }> {
  const rows = db.select().from(knowledge).all();
  const qvec = new Float32Array(queryEmbedding);

  return rows
    .filter(r => r.embedding != null)
    .map(r => {
      const buf = r.embedding as Buffer;
      const vec = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      return {
        id: r.id,
        content: r.content,
        source: r.source,
        cardId: r.cardId,
        similarity: cosineSimilarity(qvec, vec),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
