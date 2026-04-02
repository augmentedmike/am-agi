import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { execSync } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────────

type RecurrenceRule = 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;

interface ParseResult {
  title: string;
  scheduledAt: string | null;
  allDay: boolean;
  recurrenceRule: RecurrenceRule;
}

// ── Validation ─────────────────────────────────────────────────────────────────

const requestSchema = z.object({
  text: z.string().min(1, 'text is required'),
  referenceDate: z.string().optional(),
});

// ── API key resolution ─────────────────────────────────────────────────────────

function getApiKey(): string | undefined {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const key = execSync('vault get ANTHROPIC_API_KEY 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
    if (key) return key;
  } catch {}
  return undefined;
}

// ── System prompt ──────────────────────────────────────────────────────────────

function buildPrompt(text: string, referenceDate: string): string {
  return `You are a calendar event parser. Extract structured event data from natural language text.

Reference date (treat as "today"): ${referenceDate}

User input: "${text}"

Return ONLY valid JSON with this exact shape:
{
  "title": "<cleaned event title, no date/time phrases>",
  "scheduledAt": "<ISO 8601 datetime string, or null if no date found>",
  "allDay": <true if no specific time is mentioned or 'all day' is specified, false otherwise>,
  "recurrenceRule": <"daily" | "weekly" | "monthly" | "weekdays" | null>
}

Rules:
- Resolve relative dates ("tomorrow", "next Friday", "in 3 days") against the reference date.
- "next Friday" means the Friday of the coming week, not the current day if today is Friday.
- All-day events: use midnight (T00:00:00.000Z) for scheduledAt and set allDay: true.
- Timed events: set allDay: false, use the specified or implied local time in ISO format.
- Recurrence: "every day" → "daily", "every weekday"/"Mon-Fri" → "weekdays", "every week"/"weekly" → "weekly", "every month"/"monthly" → "monthly".
- If no date or time is present, set scheduledAt: null and allDay: false.
- If no recurrence is mentioned, set recurrenceRule: null.
- Title must be clean — remove date, time, and recurrence phrases.
- No explanation, no markdown, no code block — just the raw JSON object.`;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { text, referenceDate } = parsed.data;
  const refDate = referenceDate ?? new Date().toISOString();

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const client = new Anthropic({ apiKey });

  let raw: string;
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: buildPrompt(text, refDate) }],
    });
    const block = message.content[0];
    raw = block.type === 'text' ? block.text.trim() : '';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Claude API error: ${msg}` }, { status: 502 });
  }

  // Strip markdown code fences if Claude added them
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let result: ParseResult;
  try {
    result = JSON.parse(cleaned) as ParseResult;
  } catch {
    // Ambiguous/nonsense input — return safe fallback
    return NextResponse.json({
      title: text,
      scheduledAt: null,
      allDay: false,
      recurrenceRule: null,
    } satisfies ParseResult);
  }

  // Validate and sanitise the parsed result
  const safeResult: ParseResult = {
    title: typeof result.title === 'string' && result.title.trim() ? result.title.trim() : text,
    scheduledAt: typeof result.scheduledAt === 'string' && result.scheduledAt ? result.scheduledAt : null,
    allDay: Boolean(result.allDay),
    recurrenceRule: (['daily', 'weekly', 'monthly', 'weekdays'] as const).includes(result.recurrenceRule as string)
      ? (result.recurrenceRule as RecurrenceRule)
      : null,
  };

  return NextResponse.json(safeResult);
}
