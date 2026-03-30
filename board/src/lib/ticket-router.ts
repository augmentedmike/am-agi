export type RoutingOperator = 'eq' | 'contains';
export type RoutingField = 'severity' | 'product' | 'source';

export type RoutingRuleMatch = {
  field: RoutingField;
  op: RoutingOperator;
  value: string;
};

export type RoutingRule = {
  match: RoutingRuleMatch;
  assign: { column?: string; assignee?: string };
};

export type RoutingResult = { column: string; assignee?: string };

export const DEFAULT_COLUMN = 'incoming';

/**
 * Test whether a single routing rule matches the given ticket fields.
 */
export function matchRule(
  rule: RoutingRule,
  ticket: Record<string, string | number | null | undefined>,
): boolean {
  const raw = ticket[rule.match.field];
  if (raw === null || raw === undefined) return false;
  const strVal = String(raw);
  const ruleVal = rule.match.value;

  switch (rule.match.op) {
    case 'eq':
      return strVal === ruleVal;
    case 'contains':
      return strVal.toLowerCase().includes(ruleVal.toLowerCase());
    default:
      return false;
  }
}

/**
 * Apply rules in order; return the first matching result.
 * Falls back to { column: DEFAULT_COLUMN } if no rule matches.
 */
export function routeTicket(
  rules: RoutingRule[],
  ticket: Record<string, string | number | null | undefined>,
): RoutingResult {
  for (const rule of rules) {
    if (matchRule(rule, ticket)) {
      return {
        column: rule.assign.column ?? DEFAULT_COLUMN,
        ...(rule.assign.assignee ? { assignee: rule.assign.assignee } : {}),
      };
    }
  }
  return { column: DEFAULT_COLUMN };
}

/**
 * Parse a JSON string into a RoutingRule array. Returns [] on parse error.
 */
export function loadRulesFromJson(json: string): RoutingRule[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as RoutingRule[]) : [];
  } catch {
    return [];
  }
}
