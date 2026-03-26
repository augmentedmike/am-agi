import { eq } from 'drizzle-orm';
import { teamMembers, TeamRole } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

export function listTeamMembers(db: Db) {
  return db.select().from(teamMembers).all();
}

export function getTeamMember(db: Db, id: string) {
  return db.select().from(teamMembers).where(eq(teamMembers.id, id)).get();
}

export type CreateTeamMemberInput = {
  name: string;
  email: string;
  jobTitle?: string;
  role?: TeamRole;
  avatarUrl?: string;
};

export function createTeamMember(db: Db, input: CreateTeamMemberInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const member = {
    id,
    name: input.name,
    email: input.email,
    jobTitle: input.jobTitle ?? '',
    role: (input.role ?? 'tester') as TeamRole,
    avatarUrl: input.avatarUrl ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(teamMembers).values(member).run();
  return member;
}

export type UpdateTeamMemberInput = {
  name?: string;
  email?: string;
  jobTitle?: string;
  role?: TeamRole;
  avatarUrl?: string;
};

export function updateTeamMember(db: Db, id: string, input: UpdateTeamMemberInput) {
  const member = getTeamMember(db, id);
  if (!member) return null;
  const now = new Date().toISOString();
  db.update(teamMembers)
    .set({
      name: input.name ?? member.name,
      email: input.email ?? member.email,
      jobTitle: input.jobTitle ?? member.jobTitle,
      role: input.role ?? member.role,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : member.avatarUrl,
      updatedAt: now,
    })
    .where(eq(teamMembers.id, id))
    .run();
  return getTeamMember(db, id);
}

export function deleteTeamMember(db: Db, id: string) {
  db.delete(teamMembers).where(eq(teamMembers.id, id)).run();
}
