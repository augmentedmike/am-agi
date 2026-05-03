import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Static registry — board must not cross-import from agent at build time (Turbopack).
// Keep in sync with agent/src/templates/index.ts when adapters are added/removed.
// Only engineering/AI specialist templates are exposed. Non-engineering templates
// (sales-outbound, customer-support, content-marketing, etc.) are deprecated and
// available only via the agent-side ALL_TEMPLATE_TYPES registry for backward compat.
const TEMPLATES = [
  { type: 'blank',             displayName: 'Blank',             description: 'Minimal project with README.md and .gitignore',                              category: 'Software Development' },
  { type: 'next-app',         displayName: 'Next.js App',        description: 'Next.js 15 + Tailwind 4 + TypeScript + Vercel workspace',                   category: 'Software Development' },
  { type: 'bun-lib',          displayName: 'Bun Library',        description: 'Bun TypeScript library with package.json, tsconfig.json, src/index.ts, and tests', category: 'Software Development' },
  { type: 'am-board',          displayName: 'AM Board',           description: 'AM autonomous agent project with Kanban board, criteria-driven workflow, and CLI tooling', category: 'Software Development' },
];

export async function GET() {
  return NextResponse.json(TEMPLATES);
}
