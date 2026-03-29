import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const DEFAULT_STAGES = [
  { name: 'Lead', color: '#6366f1', isTerminal: false },
  { name: 'Contacted', color: '#8b5cf6', isTerminal: false },
  { name: 'Qualified', color: '#06b6d4', isTerminal: false },
  { name: 'Proposal', color: '#f59e0b', isTerminal: false },
  { name: 'Negotiating', color: '#f97316', isTerminal: false },
  { name: 'Won', color: '#22c55e', isTerminal: true },
  { name: 'Lost', color: '#ef4444', isTerminal: true },
];

export function seedDefaultPipeline(sqlite: InstanceType<typeof Database>): void {
  const existing = sqlite.prepare('SELECT id FROM pipelines LIMIT 1').get();
  if (existing) return; // already seeded

  const pipelineId = randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(
    'INSERT INTO pipelines (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(pipelineId, 'Contacts', 'Default pipeline for contact management', now, now);

  for (let i = 0; i < DEFAULT_STAGES.length; i++) {
    const stage = DEFAULT_STAGES[i];
    sqlite.prepare(
      'INSERT INTO pipeline_stages (id, pipeline_id, name, position, color, is_terminal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), pipelineId, stage.name, i, stage.color, stage.isTerminal ? 1 : 0, now);
  }
}
