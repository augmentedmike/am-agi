export interface TemplateMeta {
  type: string;
  displayName: string;
  description: string;
}

export const TEMPLATE_REGISTRY: TemplateMeta[] = [
  {
    type: 'next-app',
    displayName: 'Next.js App',
    description: 'Full-stack Next.js app with Tailwind, TypeScript, and Vercel-ready config',
  },
  {
    type: 'bun-lib',
    displayName: 'Bun Library',
    description: 'Minimal Bun/TypeScript library with tests and publish config',
  },
  {
    type: 'blank',
    displayName: 'Blank',
    description: 'Empty project — start from scratch',
  },
  {
    type: 'sales-outbound',
    displayName: 'Sales Outbound',
    description: 'AI-assisted outbound sales — lead management + Claude email drafting',
  },
  {
    type: 'customer-support',
    displayName: 'Customer Support',
    description: 'AI-powered support ticket queue with Claude response drafting',
  },
  {
    type: 'content-marketing',
    displayName: 'Content Marketing',
    description: 'Content pipeline with AI-assisted drafting, review, and scheduling',
  },
];
