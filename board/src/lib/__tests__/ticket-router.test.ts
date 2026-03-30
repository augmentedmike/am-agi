import { describe, it, expect } from 'bun:test';
import { routeTicket, matchRule, loadRulesFromJson, DEFAULT_COLUMN } from '../ticket-router';
import type { RoutingRule } from '../ticket-router';

describe('routeTicket', () => {
  it('returns default column when rules is empty', () => {
    const result = routeTicket([], { severity: 'P0', product: 'core' });
    expect(result.column).toBe(DEFAULT_COLUMN);
    expect(result.assignee).toBeUndefined();
  });

  it('matches eq operator', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'severity', op: 'eq', value: 'P0' }, assign: { column: 'critical-queue', assignee: 'alice' } },
    ];
    const result = routeTicket(rules, { severity: 'P0' });
    expect(result.column).toBe('critical-queue');
    expect(result.assignee).toBe('alice');
  });

  it('does not match eq when value differs', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'severity', op: 'eq', value: 'P0' }, assign: { column: 'critical-queue' } },
    ];
    const result = routeTicket(rules, { severity: 'P1' });
    expect(result.column).toBe(DEFAULT_COLUMN);
  });

  it('matches contains operator case-insensitively', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'product', op: 'contains', value: 'billing' }, assign: { column: 'billing-queue' } },
    ];
    const result = routeTicket(rules, { product: 'Billing Portal' });
    expect(result.column).toBe('billing-queue');
  });

  it('does not match contains when value absent', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'product', op: 'contains', value: 'billing' }, assign: { column: 'billing-queue' } },
    ];
    const result = routeTicket(rules, { product: 'auth service' });
    expect(result.column).toBe(DEFAULT_COLUMN);
  });

  it('first-match wins', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'severity', op: 'eq', value: 'P0' }, assign: { column: 'first' } },
      { match: { field: 'severity', op: 'eq', value: 'P0' }, assign: { column: 'second' } },
    ];
    const result = routeTicket(rules, { severity: 'P0' });
    expect(result.column).toBe('first');
  });

  it('falls through to second rule when first does not match', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'severity', op: 'eq', value: 'P0' }, assign: { column: 'critical' } },
      { match: { field: 'product', op: 'eq', value: 'core' }, assign: { column: 'core-queue' } },
    ];
    const result = routeTicket(rules, { severity: 'P1', product: 'core' });
    expect(result.column).toBe('core-queue');
  });

  it('returns default when no field is null', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'severity', op: 'eq', value: 'P0' }, assign: { column: 'critical' } },
    ];
    const result = routeTicket(rules, { severity: null });
    expect(result.column).toBe(DEFAULT_COLUMN);
  });
});

describe('loadRulesFromJson', () => {
  it('parses valid JSON array', () => {
    const json = JSON.stringify([
      { match: { field: 'severity', op: 'eq', value: 'P0' }, assign: { column: 'c' } },
    ]);
    const rules = loadRulesFromJson(json);
    expect(rules).toHaveLength(1);
  });

  it('returns empty array for invalid JSON', () => {
    expect(loadRulesFromJson('not-json')).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    expect(loadRulesFromJson('{"foo":"bar"}')).toEqual([]);
  });
});
