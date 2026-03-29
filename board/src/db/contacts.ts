import { eq, and } from 'drizzle-orm';
import { contacts, contactMemoryLinks, ContactKind } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

export function listContacts(db: Db) {
  return db.select().from(contacts).all();
}

export function getContact(db: Db, id: string) {
  return db.select().from(contacts).where(eq(contacts.id, id)).get() ?? null;
}

export type CreateContactInput = {
  kind?: ContactKind;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  role?: string | null;
  source?: string | null;
  tags?: string[];
  notes?: string | null;
  avatarUrl?: string | null;
  linkedMemoryIds?: string[];
};

export function createContact(db: Db, input: CreateContactInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record = {
    id,
    kind: (input.kind ?? 'person') as ContactKind,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    company: input.company ?? null,
    role: input.role ?? null,
    source: input.source ?? null,
    tags: input.tags ?? [],
    notes: input.notes ?? null,
    avatarUrl: input.avatarUrl ?? null,
    linkedMemoryIds: input.linkedMemoryIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
  db.insert(contacts).values(record).run();
  return record;
}

export type UpdateContactInput = {
  kind?: ContactKind;
  name?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  role?: string | null;
  source?: string | null;
  tags?: string[];
  notes?: string | null;
  avatarUrl?: string | null;
  linkedMemoryIds?: string[];
};

export function updateContact(db: Db, id: string, input: UpdateContactInput) {
  const contact = getContact(db, id);
  if (!contact) return null;
  const now = new Date().toISOString();
  db.update(contacts)
    .set({
      kind: input.kind ?? contact.kind,
      name: input.name ?? contact.name,
      email: input.email !== undefined ? input.email : contact.email,
      phone: input.phone !== undefined ? input.phone : contact.phone,
      company: input.company !== undefined ? input.company : contact.company,
      role: input.role !== undefined ? input.role : contact.role,
      source: input.source !== undefined ? input.source : contact.source,
      tags: input.tags ?? contact.tags,
      notes: input.notes !== undefined ? input.notes : contact.notes,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : contact.avatarUrl,
      linkedMemoryIds: input.linkedMemoryIds ?? contact.linkedMemoryIds,
      updatedAt: now,
    })
    .where(eq(contacts.id, id))
    .run();
  return getContact(db, id);
}

export function deleteContact(db: Db, id: string) {
  db.delete(contactMemoryLinks).where(eq(contactMemoryLinks.contactId, id)).run();
  db.delete(contacts).where(eq(contacts.id, id)).run();
}

export function getContactMemoryLinks(db: Db, contactId: string) {
  return db.select().from(contactMemoryLinks).where(eq(contactMemoryLinks.contactId, contactId)).all();
}

export function linkMemory(db: Db, contactId: string, memoryId: string) {
  const contact = getContact(db, contactId);
  if (!contact) return null;
  const now = new Date().toISOString();
  const id = randomUUID();
  const link = { id, contactId, memoryId, createdAt: now };
  db.insert(contactMemoryLinks).values(link).run();

  // Sync denormalised cache
  const ids = new Set(contact.linkedMemoryIds);
  ids.add(memoryId);
  db.update(contacts)
    .set({ linkedMemoryIds: Array.from(ids), updatedAt: now })
    .where(eq(contacts.id, contactId))
    .run();

  return link;
}

export function unlinkMemory(db: Db, contactId: string, memoryId: string) {
  const contact = getContact(db, contactId);
  if (!contact) return false;
  db.delete(contactMemoryLinks)
    .where(and(eq(contactMemoryLinks.contactId, contactId), eq(contactMemoryLinks.memoryId, memoryId)))
    .run();
  const now = new Date().toISOString();
  const ids = contact.linkedMemoryIds.filter(id => id !== memoryId);
  db.update(contacts)
    .set({ linkedMemoryIds: ids, updatedAt: now })
    .where(eq(contacts.id, contactId))
    .run();
  return true;
}
