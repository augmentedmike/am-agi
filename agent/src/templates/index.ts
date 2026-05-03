import { blankAdapter } from './adapters/blank';
import { bunLibAdapter } from './adapters/bun-lib';
import { nextAppAdapter } from './adapters/next-app';
import { salesOutboundAdapter } from './adapters/sales-outbound';
import { customerSupportAdapter } from './adapters/customer-support';
import { contentMarketingAdapter } from './adapters/content-marketing';
import { amBoardAdapter } from './adapters/am-board';
import { customerSuccessAdapter } from './adapters/customer-success';
import { hiringAdapter } from './adapters/hiring';
import { partnershipsAdapter } from './adapters/partnerships';
import { prOutreachAdapter } from './adapters/pr-outreach';
import { knowledgeBaseAdapter } from './adapters/knowledge-base';
import { communityAdapter } from './adapters/community';
import { opsAdapter } from './adapters/ops';
import { moltbookResearchAdapter } from './adapters/moltbook-research';
import type { TemplateSpec } from './spec';

export type { TemplateSpec } from './spec';

export interface ProjectTemplateAdapter {
  type: string;
  displayName: string;
  description: string;
  spec: TemplateSpec;
  scaffold(name: string, dest: string): void;
}

/**
 * Default template types shown to users.
 * Engineering-first: only engineering/AI specialist templates are listed.
 * Non-engineering templates (sales-outbound, customer-support, etc.) remain
 * available in the registry but are not exposed in the default list.
 * @deprecated Use ENGINEERING_TEMPLATE_TYPES for new user-facing template lists.
 *             The deprecated business-function templates are retained in the
 *             registry for backward compatibility but may be removed in a future release.
 */
export const TEMPLATE_TYPES = ['next-app', 'bun-lib', 'blank', 'am-board'] as const;
export type TemplateType = typeof TEMPLATE_TYPES[number];

/** All registered template types — includes deprecated business-function templates. */
export const ALL_TEMPLATE_TYPES = [
  'next-app', 'bun-lib', 'blank', 'am-board',
  'sales-outbound', 'customer-support', 'content-marketing',
  'customer-success', 'hiring', 'partnerships', 'pr-outreach',
  'knowledge-base', 'community', 'ops',
] as const;

const registry: Record<string, ProjectTemplateAdapter> = {
  'next-app': nextAppAdapter,
  'bun-lib': bunLibAdapter,
  'blank': blankAdapter,
  'sales-outbound': salesOutboundAdapter,
  'customer-support': customerSupportAdapter,
  'content-marketing': contentMarketingAdapter,
  'am-board': amBoardAdapter,
  'customer-success': customerSuccessAdapter,
  'hiring': hiringAdapter,
  'partnerships': partnershipsAdapter,
  'pr-outreach': prOutreachAdapter,
  'knowledge-base': knowledgeBaseAdapter,
  'community': communityAdapter,
  'ops': opsAdapter,
  'moltbook-research': moltbookResearchAdapter,
};

export function getAdapter(type: string): ProjectTemplateAdapter {
  const adapter = registry[type];
  if (!adapter) {
    throw new Error(`Unknown template type: "${type}". Valid types: ${ALL_TEMPLATE_TYPES.join(', ')}`);
  }
  return adapter;
}
