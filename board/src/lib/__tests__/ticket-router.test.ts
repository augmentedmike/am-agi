import { describe, it, expect } from 'bun:test';
import { routeTicket } from '../ticket-router';
import type { RoutingRule } from '../ticket-router';

describe('routeTicket', () => {
  it('returns default column when there are no rules', () => {
    const result = routeTicket([], { severity: 'P0', product: 'API' });
    expect(result.column).toBe('incoming');
    expect(result.assignee).toBeUndefined();
  });

  it('returns default column when no rule matches', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'severity', op: 'eq', value: 'P0' }, column: 'critical' },
    ];
    const result = routeTicket(rules, { severity: 'P3' });
    expect(result.column).toBe('incoming');
  });

  it('eq operator matches exact value (case-insensitive)', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'severity', op: 'eq', value: 'P0' }, column: 'critical', assignee: 'alice' },
    ];
    expect(routeTicket(rules, { severity: 'P0' }).column).toBe('critical');
    expect(routeTicket(rules, { severity: 'P0' }).assignee).toBe('alice');
    expect(routeTicket(rules, { severity: 'p0' }).column).toBe('critical');
    expect(routeTicket(rules, { severity: 'P1' }).column).toBe('incoming');
  });

  it('contains operator matches substring (case-insensitive)', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'product', op: 'contains', value: 'billing' }, column: 'billing-queue' },
    ];
    expect(routeTicket(rules, { product: 'Billing API' }).column).toBe('billing-queue');
    expect(routeTicket(rules, { product: 'BILLING' }).column).toBe('billing-queue');
    expect(routeTicket(rules, { product: 'auth' }).column).toBe('incoming');
  });

  it('first-match wins — stops at first matching rule', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'severity', op: 'eq', value: 'P0' }, column: 'first' },
      { match: { field: 'severity', op: 'eq', value: 'P0' }, column: 'second' },
    ];
    expect(routeTicket(rules, { severity: 'P0' }).column).toBe('first');
  });

  it('matches on source field', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'source', op: 'eq', value: 'email' }, column: 'email-queue' },
    ];
    expect(routeTicket(rules, { source: 'email' }).column).toBe('email-queue');
    expect(routeTicket(rules, { source: 'chat' }).column).toBe('incoming');
  });

  it('treats missing ticket field as empty string — no match', () => {
    const rules: RoutingRule[] = [
      { match: { field: 'product', op: 'eq', value: 'API' }, column: 'api-queue' },
    ];
    // product not provided
    expect(routeTicket(rules, { severity: 'P1' }).column).toBe('incoming');
  });
});
