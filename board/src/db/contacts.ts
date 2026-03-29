import { eq, and } from 'drizzle-orm';
import { contacts, contactMemories, MemoryTerm } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

// ── Contacts ─────────────────────────────────────────────────────────────────

export function listContacts(db: Db) {
  return db.select().from(contacts).all();
}

export function getContact(db: Db, id: string) {
  return db.select().from(contacts).where(eq(contacts.id, id)).get();
}

export type CreateContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  tags?: string[];
};

export function createContact(db: Db, input: CreateContactInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const contact = {
    id,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    company: input.company ?? null,
    notes: input.notes ?? null,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  db.insert(contacts).values(contact).run();
  return contact;
}

export type UpdateContactInput = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  tags?: string[];
};

export function updateContact(db: Db, id: string, input: UpdateContactInput) {
  const contact = getContact(db, id);
  if (!contact) return null;
  const now = new Date().toISOString();
  db.update(contacts)
    .set({
      name: input.name ?? contact.name,
      email: 'email' in input ? (input.email ?? null) : contact.email,
      phone: 'phone' in input ? (input.phone ?? null) : contact.phone,
      company: 'company' in input ? (input.company ?? null) : contact.company,
      notes: 'notes' in input ? (input.notes ?? null) : contact.notes,
      tags: input.tags !== undefined ? input.tags : contact.tags,
      updatedAt: now,
    })
    .where(eq(contacts.id, id))
    .run();
  return getContact(db, id);
}

export function deleteContact(db: Db, id: string) {
  // Cascade: remove all associated memory rows first
  db.delete(contactMemories).where(eq(contactMemories.contactId, id)).run();
  db.delete(contacts).where(eq(contacts.id, id)).run();
}

// ── Contact Memories ──────────────────────────────────────────────────────────

export function listContactMemories(db: Db, contactId: string) {
  return db.select().from(contactMemories).where(eq(contactMemories.contactId, contactId)).all();
}

export type AddContactMemoryInput = {
  memoryRef: string;
  memoryTerm: MemoryTerm;
};

export function addContactMemory(db: Db, contactId: string, input: AddContactMemoryInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const row = {
    id,
    contactId,
    memoryRef: input.memoryRef,
    memoryTerm: input.memoryTerm,
    createdAt: now,
  };
  db.insert(contactMemories).values(row).run();
  return row;
}

export function removeContactMemory(db: Db, contactId: string, memoryRef: string) {
  db.delete(contactMemories)
    .where(and(eq(contactMemories.contactId, contactId), eq(contactMemories.memoryRef, memoryRef)))
    .run();
}
