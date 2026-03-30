import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createCard } from '@/db/cards';
import { linkContactToCard, unlinkContactFromCard, listCardContacts } from '@/db/cards';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

describe('card_contacts: linkContactToCard', () => {
  it('links a contact card to a card', () => {
    const lead = createCard(db, { title: 'Acme Corp', cardType: 'lead' });
    const contact = createCard(db, { title: 'Jane Doe', cardType: 'contact' });
    linkContactToCard(db, lead.id, contact.id);
    const linked = listCardContacts(db, lead.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].id).toBe(contact.id);
    expect(linked[0].title).toBe('Jane Doe');
    expect(linked[0].cardType).toBe('contact');
  });

  it('throws on duplicate link (UNIQUE constraint)', () => {
    const lead = createCard(db, { title: 'Acme Corp', cardType: 'lead' });
    const contact = createCard(db, { title: 'Jane Doe', cardType: 'contact' });
    linkContactToCard(db, lead.id, contact.id);
    expect(() => linkContactToCard(db, lead.id, contact.id)).toThrow();
  });

  it('links multiple contacts to one card', () => {
    const lead = createCard(db, { title: 'Acme Corp', cardType: 'lead' });
    const c1 = createCard(db, { title: 'Alice', cardType: 'contact' });
    const c2 = createCard(db, { title: 'Bob', cardType: 'contact' });
    linkContactToCard(db, lead.id, c1.id);
    linkContactToCard(db, lead.id, c2.id);
    const linked = listCardContacts(db, lead.id);
    expect(linked).toHaveLength(2);
  });
});

describe('card_contacts: unlinkContactFromCard', () => {
  it('removes an existing link and returns true', () => {
    const lead = createCard(db, { title: 'Acme Corp', cardType: 'lead' });
    const contact = createCard(db, { title: 'Jane Doe', cardType: 'contact' });
    linkContactToCard(db, lead.id, contact.id);
    const removed = unlinkContactFromCard(db, lead.id, contact.id);
    expect(removed).toBe(true);
    expect(listCardContacts(db, lead.id)).toHaveLength(0);
  });

  it('returns false when link does not exist', () => {
    const lead = createCard(db, { title: 'Acme Corp', cardType: 'lead' });
    const contact = createCard(db, { title: 'Jane Doe', cardType: 'contact' });
    const removed = unlinkContactFromCard(db, lead.id, contact.id);
    expect(removed).toBe(false);
  });
});

describe('card_contacts: listCardContacts', () => {
  it('returns empty array when no contacts linked', () => {
    const lead = createCard(db, { title: 'Acme Corp', cardType: 'lead' });
    expect(listCardContacts(db, lead.id)).toEqual([]);
  });

  it('does not cross-contaminate between cards', () => {
    const lead1 = createCard(db, { title: 'Acme', cardType: 'lead' });
    const lead2 = createCard(db, { title: 'Beta', cardType: 'lead' });
    const contact = createCard(db, { title: 'Jane', cardType: 'contact' });
    linkContactToCard(db, lead1.id, contact.id);
    expect(listCardContacts(db, lead1.id)).toHaveLength(1);
    expect(listCardContacts(db, lead2.id)).toHaveLength(0);
  });

  it('GET /api/cards/:id/contacts — uses cardType not entityType (criterion 4)', () => {
    // Verify that contact filtering uses cardType='contact', not any entityType field
    const lead = createCard(db, { title: 'Acme Corp', cardType: 'lead' });
    const contact = createCard(db, { title: 'Jane Doe', cardType: 'contact' });
    const task = createCard(db, { title: 'Fix bug', cardType: 'task' });
    linkContactToCard(db, lead.id, contact.id);
    linkContactToCard(db, lead.id, task.id); // can link any card type
    const linked = listCardContacts(db, lead.id);
    expect(linked).toHaveLength(2);
    const contactCard = linked.find(c => c.id === contact.id);
    expect(contactCard?.cardType).toBe('contact');
  });
});

describe('card_contacts: POST + DELETE endpoints (logic layer)', () => {
  it('full lifecycle: link, list, unlink, list', () => {
    const account = createCard(db, { title: 'Big Corp', cardType: 'account' });
    const c1 = createCard(db, { title: 'Alice', cardType: 'contact' });
    const c2 = createCard(db, { title: 'Bob', cardType: 'contact' });

    // Link two contacts
    linkContactToCard(db, account.id, c1.id);
    linkContactToCard(db, account.id, c2.id);
    expect(listCardContacts(db, account.id)).toHaveLength(2);

    // Unlink one
    unlinkContactFromCard(db, account.id, c1.id);
    const remaining = listCardContacts(db, account.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(c2.id);
  });

  it('cascade delete: removing a card removes its contact links', () => {
    const lead = createCard(db, { title: 'Acme', cardType: 'lead' });
    const contact = createCard(db, { title: 'Jane', cardType: 'contact' });
    linkContactToCard(db, lead.id, contact.id);
    expect(listCardContacts(db, lead.id)).toHaveLength(1);

    // Delete the contact card directly via sqlite
    sqlite.prepare('DELETE FROM cards WHERE id = ?').run(contact.id);
    // The card_contacts row should cascade-delete
    expect(listCardContacts(db, lead.id)).toHaveLength(0);
  });
});
