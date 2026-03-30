import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Static registry — board must not cross-import from agent at build time (Turbopack).
// Keep in sync with agent/src/templates/index.ts when adapters are added/removed.
const TEMPLATES = [
  { type: 'blank',             displayName: 'Blank',             description: 'Minimal project with README.md and .gitignore' },
  { type: 'next-app',         displayName: 'Next.js App',        description: 'Next.js 15 + Tailwind 4 + TypeScript + Vercel workspace' },
  { type: 'bun-lib',          displayName: 'Bun Library',        description: 'Bun TypeScript library with package.json, tsconfig.json, src/index.ts, and tests' },
  { type: 'sales-outbound',   displayName: 'Sales Outbound',     description: 'AI-assisted outbound sales — lead management + Claude email drafting' },
  { type: 'customer-support', displayName: 'Customer Support',   description: 'AI-assisted customer support — ticket inbox + Claude reply drafting' },
  { type: 'content-marketing',displayName: 'Content Marketing',  description: 'AI-assisted content marketing — content calendar + Claude post generation' },
];

export async function GET() {
  return NextResponse.json(TEMPLATES);
}
