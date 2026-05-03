// DEPRECATED: Business-function template adapter. AM is now positioned as
// a gated agent runtime for engineering and AI specialist work. This adapter
// is retained for backward compatibility but not exposed in the default
// TEMPLATE_TYPES list. May be removed in a future release.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'pr-outreach',
  displayName: 'PR Outreach',
  description: 'Media outreach engine — story angle to published coverage',
  pipeline: {
    columns: [
      { id: 'story-angle', label: 'Story Angle' },
      { id: 'target-list', label: 'Target List' },
      { id: 'pitch-draft', label: 'Pitch Draft' },
      { id: 'outreach', label: 'Outreach' },
      { id: 'response', label: 'Response' },
      { id: 'coverage', label: 'Coverage' },
      { id: 'amplify', label: 'Amplify' },
    ],
    transitions: [
      { from: 'story-angle', to: 'target-list', gates: ['clear narrative angle defined'] },
      { from: 'target-list', to: 'pitch-draft', gates: ['media list finalized'] },
      { from: 'pitch-draft', to: 'outreach', gates: ['personalized pitch ready'] },
      { from: 'outreach', to: 'response', gates: ['journalist replied'] },
      { from: 'response', to: 'coverage', gates: ['publication confirmed'] },
      { from: 'coverage', to: 'amplify', gates: ['article published'] },
    ],
  },
  cardTypes: [
    {
      id: 'contact',
      label: 'Contact',
      fields: [
        { id: 'journalist', label: 'Journalist', type: 'text' as const },
        { id: 'publication', label: 'Publication', type: 'text' as const },
        { id: 'beat', label: 'Beat', type: 'text' as const },
        { id: 'coverageUrl', label: 'Coverage URL', type: 'text' as const },
      ],
    },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text' as const, required: true },
    { id: 'notes', label: 'Notes', type: 'textarea' as const },
  ],
};

export const prOutreachAdapter: ProjectTemplateAdapter = {
  type: 'pr-outreach',
  displayName: 'PR Outreach',
  description: 'Media outreach engine — story angle to published coverage',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    writeFileSync(
      join(dest, 'README.md'),
      `# ${name}\n\nPR outreach pipeline — track media contacts from pitch to published coverage.\n\n## Columns\n\n- **Story Angle** — narrative hook being developed\n- **Target List** — journalists and outlets to pitch\n- **Pitch Draft** — personalized pitches being written\n- **Outreach** — pitches sent, awaiting response\n- **Response** — journalist replied / interested\n- **Coverage** — article being written\n- **Amplify** — published — distribute and promote\n`,
      'utf8',
    );
    writeFileSync(join(dest, '.gitignore'), `node_modules/\n.env\n.env.local\n`, 'utf8');
  },
};
