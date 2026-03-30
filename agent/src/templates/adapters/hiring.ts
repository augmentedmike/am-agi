import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'hiring',
  displayName: 'Hiring Pipeline',
  description: 'End-to-end recruiting — source to hire with scorecard gating',
  pipeline: {
    columns: [
      { id: 'sourced', label: 'Sourced' },
      { id: 'screened', label: 'Screened' },
      { id: 'interview', label: 'Interview' },
      { id: 'assessment', label: 'Assessment' },
      { id: 'decision', label: 'Decision' },
      { id: 'offer', label: 'Offer' },
      { id: 'hired', label: 'Hired' },
    ],
    transitions: [
      { from: 'sourced', to: 'screened', gates: ['resume and criteria match'] },
      { from: 'screened', to: 'interview', gates: ['phone screen passed'] },
      { from: 'interview', to: 'assessment', gates: ['structured interview feedback recorded'] },
      { from: 'assessment', to: 'decision', gates: ['scorecard aggregated'] },
      { from: 'decision', to: 'offer', gates: ['hire decision made'] },
      { from: 'offer', to: 'hired', gates: ['offer accepted'] },
    ],
  },
  cardTypes: [
    {
      id: 'candidate',
      label: 'Candidate',
      fields: [
        { id: 'role', label: 'Role', type: 'text' as const },
        { id: 'email', label: 'Email', type: 'text' as const },
        { id: 'source', label: 'Source', type: 'text' as const },
        { id: 'score', label: 'Score', type: 'number' as const },
        { id: 'interviewers', label: 'Interviewers', type: 'text' as const },
      ],
    },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text' as const, required: true },
    { id: 'notes', label: 'Notes', type: 'textarea' as const },
  ],
};

export const hiringAdapter: ProjectTemplateAdapter = {
  type: 'hiring',
  displayName: 'Hiring Pipeline',
  description: 'End-to-end recruiting — source to hire with scorecard gating',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    writeFileSync(
      join(dest, 'README.md'),
      `# ${name}\n\nRecruiting pipeline — track candidates from sourcing to hired.\n\n## Columns\n\n- **Sourced** — candidates identified\n- **Screened** — resume review done\n- **Interview** — interviews scheduled/completed\n- **Assessment** — take-home or technical assessment\n- **Decision** — hire/no-hire decision\n- **Offer** — offer extended\n- **Hired** — offer accepted, onboarding scheduled\n`,
      'utf8',
    );
    writeFileSync(join(dest, '.gitignore'), `node_modules/\n.env\n.env.local\n`, 'utf8');
  },
};
