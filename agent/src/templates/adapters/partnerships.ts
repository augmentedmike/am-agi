// DEPRECATED: Business-function template adapter. AM is now positioned as
// a gated agent runtime for engineering and AI specialist work. This adapter
// is retained for backward compatibility but not exposed in the default
// TEMPLATE_TYPES list. May be removed in a future release.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'partnerships',
  displayName: 'Partnerships',
  description: 'BizDev pipeline — from target identification to active partnership',
  pipeline: {
    columns: [
      { id: 'target', label: 'Target' },
      { id: 'outreach', label: 'Outreach' },
      { id: 'negotiation', label: 'Negotiation' },
      { id: 'proposal', label: 'Proposal' },
      { id: 'agreement', label: 'Agreement' },
      { id: 'integration', label: 'Integration' },
      { id: 'active', label: 'Active' },
    ],
    transitions: [
      { from: 'target', to: 'outreach', gates: ['strategic fit criteria met'] },
      { from: 'outreach', to: 'negotiation', gates: ['partner engaged'] },
      { from: 'negotiation', to: 'proposal', gates: ['internal alignment reached'] },
      { from: 'proposal', to: 'agreement', gates: ['legal approval obtained'] },
      { from: 'agreement', to: 'integration', gates: ['contract signed'] },
      { from: 'integration', to: 'active', gates: ['integration complete'] },
    ],
  },
  cardTypes: [
    {
      id: 'partner',
      label: 'Partner',
      fields: [
        { id: 'company', label: 'Company', type: 'text' as const },
        { id: 'contact', label: 'Contact', type: 'text' as const },
        { id: 'partnerType', label: 'Partner Type', type: 'text' as const },
        { id: 'estimatedRevenue', label: 'Est. Revenue', type: 'number' as const },
      ],
    },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text' as const, required: true },
    { id: 'notes', label: 'Notes', type: 'textarea' as const },
  ],
};

export const partnershipsAdapter: ProjectTemplateAdapter = {
  type: 'partnerships',
  displayName: 'Partnerships',
  description: 'BizDev pipeline — from target identification to active partnership',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    writeFileSync(
      join(dest, 'README.md'),
      `# ${name}\n\nPartnerships pipeline — track BizDev from target to active partner.\n\n## Columns\n\n- **Target** — potential partners identified\n- **Outreach** — initial contact made\n- **Negotiation** — terms under discussion\n- **Proposal** — formal proposal sent\n- **Agreement** — legal review and signing\n- **Integration** — technical/operational integration\n- **Active** — live partnership\n`,
      'utf8',
    );
    writeFileSync(join(dest, '.gitignore'), `node_modules/\n.env\n.env.local\n`, 'utf8');
  },
};
