import { z } from 'zod';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { getSetting } from '@/db/settings';

// ─── Schema ──────────────────────────────────────────────────────────────────

export const routingRuleSchema = z.object({
  match: z.object({
    field: z.enum(['severity', 'product', 'source']),
    op: z.enum(['eq', 'contains']),
    value: z.string(),
  }),
  column: z.string().min(1),
  assignee: z.string().optional(),
});

export type RoutingRule = z.infer<typeof routingRuleSchema>;

export const routingRulesSchema = z.array(routingRuleSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Db = BetterSQLite3Database<typeof schema>;

export function loadRules(db: Db): RoutingRule[] {
  const raw = getSetting(db, 'support_routing_rules');
  if (!raw) return [];
  try {
    const parsed = routingRulesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export type TicketFields = {
  severity?: string;
  product?: string;
  source?: string;
};

export type RouteResult = {
  column: string;
  assignee?: string;
};

function matchesRule(rule: RoutingRule, ticket: TicketFields): boolean {
  const actual = ticket[rule.match.field] ?? '';
  switch (rule.match.op) {
    case 'eq':
      return actual.toLowerCase() === rule.match.value.toLowerCase();
    case 'contains':
      return actual.toLowerCase().includes(rule.match.value.toLowerCase());
    default:
      return false;
  }
}

/**
 * Returns the first matching rule's { column, assignee }, or defaults
 * to { column: 'incoming' } if no rule matches.
 */
export function routeTicket(rules: RoutingRule[], ticket: TicketFields): RouteResult {
  for (const rule of rules) {
    if (matchesRule(rule, ticket)) {
      return { column: rule.column, assignee: rule.assignee };
    }
  }
  return { column: 'incoming' };
}
