import { eq, and } from 'drizzle-orm';
import { automationRules, AutomationTriggerType, AutomationActionType, AutomationTriggerConditions, AutomationActionParams } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

export type CreateRuleInput = {
  name: string;
  enabled?: boolean;
  projectId?: string | null;
  triggerType: AutomationTriggerType;
  triggerConditions?: AutomationTriggerConditions;
  actionType: AutomationActionType;
  actionParams?: AutomationActionParams;
};

export type UpdateRuleInput = Partial<Omit<CreateRuleInput, 'triggerType' | 'actionType'>> & {
  triggerType?: AutomationTriggerType;
  actionType?: AutomationActionType;
};

export function listRules(db: Db, filters?: { projectId?: string }) {
  if (filters?.projectId) {
    return db.select().from(automationRules)
      .where(eq(automationRules.projectId, filters.projectId))
      .all();
  }
  return db.select().from(automationRules).all();
}

export function getRule(db: Db, id: string) {
  return db.select().from(automationRules).where(eq(automationRules.id, id)).get();
}

export function createRule(db: Db, input: CreateRuleInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const rule = {
    id,
    name: input.name,
    enabled: input.enabled ?? true,
    projectId: input.projectId ?? null,
    triggerType: input.triggerType,
    triggerConditions: input.triggerConditions ?? {},
    actionType: input.actionType,
    actionParams: input.actionParams ?? {},
    createdAt: now,
    updatedAt: now,
  };
  db.insert(automationRules).values(rule).run();
  return rule;
}

export function updateRule(db: Db, id: string, input: UpdateRuleInput) {
  const existing = getRule(db, id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated = {
    name: input.name ?? existing.name,
    enabled: input.enabled ?? existing.enabled,
    projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
    triggerType: input.triggerType ?? existing.triggerType,
    triggerConditions: input.triggerConditions ?? existing.triggerConditions,
    actionType: input.actionType ?? existing.actionType,
    actionParams: input.actionParams ?? existing.actionParams,
    updatedAt: now,
  };
  db.update(automationRules).set(updated).where(eq(automationRules.id, id)).run();
  return getRule(db, id);
}

export function deleteRule(db: Db, id: string): boolean {
  const existing = getRule(db, id);
  if (!existing) return false;
  db.delete(automationRules).where(eq(automationRules.id, id)).run();
  return true;
}
