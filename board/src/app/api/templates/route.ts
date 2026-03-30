import { NextResponse } from 'next/server';
import { TEMPLATE_TYPES, getAdapter } from '@am/agent/src/templates/index';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const templates = TEMPLATE_TYPES.map(type => {
    const adapter = getAdapter(type);
    return {
      type: adapter.type,
      displayName: adapter.displayName,
      description: adapter.description,
    };
  });
  return NextResponse.json(templates);
}
