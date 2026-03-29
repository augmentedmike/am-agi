import { blankAdapter } from './adapters/blank';
import { bunLibAdapter } from './adapters/bun-lib';
import { nextAppAdapter } from './adapters/next-app';

export interface ProjectTemplateAdapter {
  type: string;
  description: string;
  scaffold(name: string, dest: string): void;
}

export const TEMPLATE_TYPES = ['next-app', 'bun-lib', 'blank'] as const;
export type TemplateType = typeof TEMPLATE_TYPES[number];

const registry: Record<string, ProjectTemplateAdapter> = {
  'next-app': nextAppAdapter,
  'bun-lib': bunLibAdapter,
  'blank': blankAdapter,
};

export function getAdapter(type: string): ProjectTemplateAdapter {
  const adapter = registry[type];
  if (!adapter) {
    throw new Error(`Unknown template type: "${type}". Valid types: ${TEMPLATE_TYPES.join(', ')}`);
  }
  return adapter;
}
