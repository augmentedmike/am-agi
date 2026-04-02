/**
 * Unit tests for POST /api/calendar/parse
 *
 * These tests mock the Anthropic SDK so they run offline without a real API key.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ── Helpers ────────────────────────────────────────────────────────────────────

// Reference date: Wednesday 2026-04-01 (April 1, 2026)
const REF_DATE = '2026-04-01T12:00:00.000Z';

// Build a minimal NextRequest-like object accepted by the route handler
function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/calendar/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Mock Anthropic SDK ─────────────────────────────────────────────────────────

// We mock the module before importing the route handler
let mockResponseText = '';

mock.module('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: async () => ({
          content: [{ type: 'text', text: mockResponseText }],
        }),
      };
    },
  };
});

// Mock vault to return a fake key
mock.module('child_process', () => ({
  execSync: () => 'sk-test-key',
  spawnSync: () => ({ stdout: '', stderr: '', status: 0 }),
}));

// Import AFTER mocks are in place
const { POST } = await import('../route');

// ── Helpers ────────────────────────────────────────────────────────────────────

async function callParse(body: unknown) {
  const req = makeReq(body);
  const res = await POST(req as never);
  const json = await res.json();
  return { status: res.status, body: json };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/calendar/parse', () => {
  beforeEach(() => {
    mockResponseText = '';
  });

  // Criterion 12: 400 on missing/empty text
  it('returns 400 when text is missing', async () => {
    const { status, body } = await callParse({ referenceDate: REF_DATE });
    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it('returns 400 when text is empty string', async () => {
    const { status, body } = await callParse({ text: '', referenceDate: REF_DATE });
    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });

  // Criterion 1 + 2: basic datetime extraction
  it('(a) extracts basic datetime from text', async () => {
    mockResponseText = JSON.stringify({
      title: 'Dentist',
      scheduledAt: '2026-04-07T15:00:00.000Z',
      allDay: false,
      recurrenceRule: null,
    });

    const { status, body } = await callParse({ text: 'dentist Tuesday at 3pm', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(body.title).toBe('Dentist');
    expect(body.scheduledAt).not.toBeNull();
    expect(body.allDay).toBe(false);
    expect(body.recurrenceRule).toBeNull();
  });

  // Criterion 3: relative date resolution
  it('(b) resolves relative date "tomorrow"', async () => {
    mockResponseText = JSON.stringify({
      title: 'Call mom',
      scheduledAt: '2026-04-02T10:00:00.000Z',
      allDay: false,
      recurrenceRule: null,
    });

    const { status, body } = await callParse({ text: 'call mom tomorrow at 10am', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(body.scheduledAt).toContain('2026-04-02');
  });

  it('(b) resolves "next Friday" relative to reference date', async () => {
    // REF_DATE is Wednesday April 1 — next Friday is April 3
    mockResponseText = JSON.stringify({
      title: 'Team lunch',
      scheduledAt: '2026-04-03T12:00:00.000Z',
      allDay: false,
      recurrenceRule: null,
    });

    const { status, body } = await callParse({ text: 'team lunch next Friday at noon', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(body.scheduledAt).toContain('2026-04-03');
  });

  // Criterion 4: recurrence detection
  it('(c) detects "every weekday" recurrence', async () => {
    mockResponseText = JSON.stringify({
      title: 'Stand-up',
      scheduledAt: '2026-04-01T09:00:00.000Z',
      allDay: false,
      recurrenceRule: 'weekdays',
    });

    const { status, body } = await callParse({ text: 'stand-up every weekday at 9am', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(body.recurrenceRule).toBe('weekdays');
  });

  it('(c) detects "weekly on Monday" recurrence', async () => {
    mockResponseText = JSON.stringify({
      title: '1:1 with manager',
      scheduledAt: '2026-04-06T14:00:00.000Z',
      allDay: false,
      recurrenceRule: 'weekly',
    });

    const { status, body } = await callParse({ text: '1:1 with manager weekly on Monday', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(body.recurrenceRule).toBe('weekly');
  });

  // Criterion 5: all-day detection
  it('(d) detects all-day event "on March 5th"', async () => {
    mockResponseText = JSON.stringify({
      title: 'Conference',
      scheduledAt: '2026-03-05T00:00:00.000Z',
      allDay: true,
      recurrenceRule: null,
    });

    const { status, body } = await callParse({ text: 'conference on March 5th', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(body.allDay).toBe(true);
    expect(body.scheduledAt).toContain('2026-03-05');
  });

  it('(d) detects "all day Friday"', async () => {
    mockResponseText = JSON.stringify({
      title: 'OOO',
      scheduledAt: '2026-04-03T00:00:00.000Z',
      allDay: true,
      recurrenceRule: null,
    });

    const { status, body } = await callParse({ text: 'OOO all day Friday', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(body.allDay).toBe(true);
  });

  // Criterion 6: no-date fallback
  it('(e) returns null scheduledAt when no date present', async () => {
    mockResponseText = JSON.stringify({
      title: 'Buy groceries',
      scheduledAt: null,
      allDay: false,
      recurrenceRule: null,
    });

    const { status, body } = await callParse({ text: 'buy groceries', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(body.scheduledAt).toBeNull();
    expect(body.allDay).toBe(false);
  });

  // Criterion 13: 200 with valid body on nonsense/ambiguous text
  it('returns 200 with valid body on ambiguous text', async () => {
    // Claude returns invalid JSON — fallback kicks in
    mockResponseText = 'I cannot determine a date from this input.';

    const { status, body } = await callParse({ text: 'asdfghjkl', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(typeof body.title).toBe('string');
    expect('scheduledAt' in body).toBe(true);
    expect('allDay' in body).toBe(true);
    expect('recurrenceRule' in body).toBe(true);
  });

  // Invalid recurrenceRule values are sanitised to null
  it('sanitises unknown recurrenceRule to null', async () => {
    mockResponseText = JSON.stringify({
      title: 'Test',
      scheduledAt: null,
      allDay: false,
      recurrenceRule: 'biweekly',
    });

    const { status, body } = await callParse({ text: 'test event biweekly', referenceDate: REF_DATE });
    expect(status).toBe(200);
    expect(body.recurrenceRule).toBeNull();
  });
});
