import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Static registry — board must not cross-import from agent at build time (Turbopack).
// Keep in sync with agent/src/templates/index.ts when adapters are added/removed.
const TEMPLATES = [
  { type: 'blank',             displayName: 'Blank',             description: 'Minimal project with README.md and .gitignore',                              category: 'Software Development' },
  { type: 'next-app',         displayName: 'Next.js App',        description: 'Next.js 15 + Tailwind 4 + TypeScript + Vercel workspace',                   category: 'Software Development' },
  { type: 'bun-lib',          displayName: 'Bun Library',        description: 'Bun TypeScript library with package.json, tsconfig.json, src/index.ts, and tests', category: 'Software Development' },
  { type: 'sales-outbound',   displayName: 'Sales Outbound',     description: 'AI-assisted outbound sales — lead management + Claude email drafting',       category: 'AI Workflows' },
  { type: 'customer-support', displayName: 'Customer Support',   description: 'AI-assisted customer support — ticket inbox + Claude reply drafting',        category: 'AI Workflows' },
  { type: 'content-marketing',displayName: 'Content Marketing',  description: 'AI-assisted content marketing — content calendar + Claude post generation',  category: 'AI Workflows' },
  { type: 'am-board',          displayName: 'AM Board',           description: 'AM autonomous agent project with Kanban board, criteria-driven workflow, and CLI tooling', category: 'Software Development' },
  { type: 'customer-success', displayName: 'Customer Success',   description: 'Account health tracking — onboarding to renewal with health scoring',                    category: 'AI Workflows' },
  { type: 'hiring',           displayName: 'Hiring Pipeline',    description: 'End-to-end recruiting — source to hire with scorecard gating',                           category: 'AI Workflows' },
  { type: 'partnerships',     displayName: 'Partnerships',       description: 'BizDev pipeline — from target identification to active partnership',                      category: 'AI Workflows' },
  { type: 'pr-outreach',      displayName: 'PR Outreach',        description: 'Media outreach engine — story angle to published coverage',                               category: 'AI Workflows' },
  { type: 'knowledge-base',   displayName: 'Knowledge Base',     description: 'Documentation system — gap identification to maintained published docs',                  category: 'AI Workflows' },
  { type: 'community',        displayName: 'Community',          description: 'Social and community engagement — signal triage to resolved conversations',               category: 'AI Workflows' },
  { type: 'ops',              displayName: 'Operations',         description: 'Internal ops and task orchestration — request intake to done',                            category: 'AI Workflows' },
];

export async function GET() {
  return NextResponse.json(TEMPLATES);
}
