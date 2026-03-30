import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'customer-success',
  displayName: 'Customer Success',
  description: 'Account health tracking — onboarding to renewal with health scoring',
  pipeline: {
    columns: [
      { id: 'onboarding', label: 'Onboarding' },
      { id: 'activation', label: 'Activation' },
      { id: 'adoption', label: 'Adoption' },
      { id: 'expansion', label: 'Expansion' },
      { id: 'renewal', label: 'Renewal' },
      { id: 'churn-risk', label: 'Churn Risk' },
    ],
    transitions: [
      { from: 'onboarding', to: 'activation', gates: ['activation milestones met'] },
      { from: 'activation', to: 'adoption', gates: ['usage threshold reached'] },
      { from: 'adoption', to: 'expansion', gates: ['expansion opportunity identified'] },
      { from: 'expansion', to: 'renewal', gates: ['health score above threshold'] },
      { from: 'renewal', to: 'churn-risk', gates: ['renewal missed or at risk'] },
      { from: 'churn-risk', to: 'renewal', gates: ['risk resolved'] },
    ],
  },
  cardTypes: [
    {
      id: 'account',
      label: 'Account',
      fields: [
        { id: 'company', label: 'Company', type: 'text' as const },
        { id: 'owner', label: 'Owner', type: 'text' as const },
        { id: 'healthScore', label: 'Health Score', type: 'number' as const },
        { id: 'mrr', label: 'MRR', type: 'number' as const },
        { id: 'renewalDate', label: 'Renewal Date', type: 'text' as const },
      ],
    },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text' as const, required: true },
    { id: 'notes', label: 'Notes', type: 'textarea' as const },
  ],
};

export const customerSuccessAdapter: ProjectTemplateAdapter = {
  type: 'customer-success',
  displayName: 'Customer Success',
  description: 'Account health tracking — onboarding to renewal with health scoring',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    writeFileSync(
      join(dest, 'README.md'),
      `# ${name}\n\nCustomer success pipeline — track accounts from onboarding to renewal.\n\n## Columns\n\n- **Onboarding** — new accounts getting set up\n- **Activation** — first success milestones reached\n- **Adoption** — regular usage patterns established\n- **Expansion** — upsell / cross-sell opportunities\n- **Renewal** — upcoming contract renewals\n- **Churn Risk** — accounts at risk of leaving\n`,
      'utf8',
    );
    writeFileSync(join(dest, '.gitignore'), `node_modules/\n.env\n.env.local\n`, 'utf8');
  },
};
