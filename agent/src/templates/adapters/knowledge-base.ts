import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'knowledge-base',
  displayName: 'Knowledge Base',
  description: 'Documentation system — gap identification to maintained published docs',
  pipeline: {
    columns: [
      { id: 'gap-identified', label: 'Gap Identified' },
      { id: 'outline', label: 'Outline' },
      { id: 'draft', label: 'Draft' },
      { id: 'review', label: 'Review' },
      { id: 'publish', label: 'Publish' },
      { id: 'maintain', label: 'Maintain' },
    ],
    transitions: [
      { from: 'gap-identified', to: 'outline', gates: ['trigger source identified (ticket or product change)'] },
      { from: 'outline', to: 'draft', gates: ['outline approved'] },
      { from: 'draft', to: 'review', gates: ['draft complete'] },
      { from: 'review', to: 'publish', gates: ['accuracy and completeness verified'] },
      { from: 'publish', to: 'maintain', gates: ['version tagged, doc published'] },
      { from: 'maintain', to: 'draft', gates: ['staleness timer triggered'] },
    ],
  },
  cardTypes: [
    {
      id: 'document',
      label: 'Document',
      fields: [
        { id: 'docType', label: 'Type', type: 'text' as const },
        { id: 'audience', label: 'Audience', type: 'text' as const },
        { id: 'version', label: 'Version', type: 'text' as const },
        { id: 'url', label: 'URL', type: 'text' as const },
      ],
    },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text' as const, required: true },
    { id: 'notes', label: 'Notes', type: 'textarea' as const },
  ],
};

export const knowledgeBaseAdapter: ProjectTemplateAdapter = {
  type: 'knowledge-base',
  displayName: 'Knowledge Base',
  description: 'Documentation system — gap identification to maintained published docs',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    writeFileSync(
      join(dest, 'README.md'),
      `# ${name}\n\nKnowledge base pipeline — track documentation from gap to published and maintained.\n\n## Columns\n\n- **Gap Identified** — missing docs discovered (from tickets, product changes)\n- **Outline** — structure planned\n- **Draft** — content being written\n- **Review** — accuracy and completeness check\n- **Publish** — live, version-tagged\n- **Maintain** — periodic refresh cycle\n`,
      'utf8',
    );
    writeFileSync(join(dest, '.gitignore'), `node_modules/\n.env\n.env.local\n`, 'utf8');
  },
};
