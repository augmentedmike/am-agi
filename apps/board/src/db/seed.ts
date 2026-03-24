import { getDb } from './client';
import { runMigrations } from './migrations';
import { createCard, updateCard } from './cards';

const { db, sqlite } = getDb();
runMigrations(db, sqlite);

const cards = [
  { title: 'Set up CI pipeline', priority: 'high' as const },
  { title: 'Implement auth middleware', priority: 'critical' as const },
  { title: 'Write API documentation', priority: 'normal' as const },
  { title: 'Add dark mode support', priority: 'low' as const },
];

for (const c of cards) {
  const card = createCard(db, c);
  updateCard(db, card.id, {
    workLogEntry: { timestamp: new Date().toISOString(), message: 'Initial card created' }
  });
  console.log('Created:', card.title);
}

console.log('Seed complete');
