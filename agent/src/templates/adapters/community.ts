// DEPRECATED: Business-function template adapter. AM is now positioned as
// a gated agent runtime for engineering and AI specialist work. This adapter
// is retained for backward compatibility but not exposed in the default
// TEMPLATE_TYPES list. May be removed in a future release.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'community',
  displayName: 'Community',
  description: 'Social and community engagement — signal triage to resolved conversations',
  pipeline: {
    columns: [
      { id: 'signal', label: 'Signal' },
      { id: 'triage', label: 'Triage' },
      { id: 'respond', label: 'Respond' },
      { id: 'engage', label: 'Engage' },
      { id: 'escalate', label: 'Escalate' },
      { id: 'archive', label: 'Archive' },
    ],
    transitions: [
      { from: 'signal', to: 'triage', gates: [] },
      { from: 'triage', to: 'respond', gates: ['sentiment classified', 'response guidelines checked'] },
      { from: 'respond', to: 'engage', gates: ['initial response sent'] },
      { from: 'engage', to: 'archive', gates: ['conversation resolved'] },
      { from: 'engage', to: 'escalate', gates: ['PR risk or support issue detected'] },
      { from: 'escalate', to: 'archive', gates: ['escalation resolved'] },
    ],
  },
  cardTypes: [
    {
      id: 'conversation',
      label: 'Conversation',
      fields: [
        { id: 'platform', label: 'Platform', type: 'text' as const },
        { id: 'author', label: 'Author', type: 'text' as const },
        { id: 'sentiment', label: 'Sentiment', type: 'text' as const },
        { id: 'url', label: 'URL', type: 'text' as const },
      ],
    },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text' as const, required: true },
    { id: 'notes', label: 'Notes', type: 'textarea' as const },
  ],
};

export const communityAdapter: ProjectTemplateAdapter = {
  type: 'community',
  displayName: 'Community',
  description: 'Social and community engagement — signal triage to resolved conversations',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    writeFileSync(
      join(dest, 'README.md'),
      `# ${name}\n\nCommunity engagement pipeline — triage signals and manage conversations to resolution.\n\n## Columns\n\n- **Signal** — mention, post, or DM detected\n- **Triage** — classify sentiment, route appropriately\n- **Respond** — draft and send initial response\n- **Engage** — ongoing conversation\n- **Escalate** — flagged for PR or support team\n- **Archive** — resolved and closed\n`,
      'utf8',
    );
    writeFileSync(join(dest, '.gitignore'), `node_modules/\n.env\n.env.local\n`, 'utf8');
  },
};
