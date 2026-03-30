import { blankAdapter } from './adapters/blank';
import { bunLibAdapter } from './adapters/bun-lib';
import { nextAppAdapter } from './adapters/next-app';
import { salesOutboundAdapter } from './adapters/sales-outbound';
import { customerSupportAdapter } from './adapters/customer-support';
import { contentMarketingAdapter } from './adapters/content-marketing';
import { amBoardAdapter } from './adapters/am-board';
import type { TemplateSpec } from './spec';

export type { TemplateSpec } from './spec';

export interface ProjectTemplateAdapter {
  type: string;
  displayName: string;
  description: string;
  spec: TemplateSpec;
  scaffold(name: string, dest: string): void;
}

export const TEMPLATE_TYPES = ['next-app', 'bun-lib', 'blank', 'sales-outbound', 'customer-support', 'content-marketing', 'am-board'] as const;
export type TemplateType = typeof TEMPLATE_TYPES[number];

const registry: Record<string, ProjectTemplateAdapter> = {
  'next-app': nextAppAdapter,
  'bun-lib': bunLibAdapter,
  'blank': blankAdapter,
  'sales-outbound': salesOutboundAdapter,
  'customer-support': customerSupportAdapter,
  'content-marketing': contentMarketingAdapter,
  'am-board': amBoardAdapter,
};

export function getAdapter(type: string): ProjectTemplateAdapter {
  const adapter = registry[type];
  if (!adapter) {
    throw new Error(`Unknown template type: "${type}". Valid types: ${TEMPLATE_TYPES.join(', ')}`);
  }
  return adapter;
}
