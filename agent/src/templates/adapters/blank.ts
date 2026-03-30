import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'blank',
  displayName: 'Blank',
  description: 'Minimal project with README.md and .gitignore',
  pipeline: {
    columns: [
      { id: 'backlog', label: 'Backlog' },
      { id: 'in-progress', label: 'In Progress' },
      { id: 'in-review', label: 'In Review' },
      { id: 'shipped', label: 'Shipped' },
    ],
    transitions: [
      { from: 'backlog', to: 'in-progress', gates: ['criteria.md written'] },
      { from: 'in-progress', to: 'in-review', gates: ['all criteria have implementation'] },
      { from: 'in-review', to: 'shipped', gates: ['all criteria verified'] },
      { from: 'in-review', to: 'in-progress', gates: ['verification failed'] },
    ],
  },
  cardTypes: [
    { id: 'task', label: 'Task', fields: [] },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text', required: true },
    { id: 'description', label: 'Description', type: 'textarea' },
  ],
};

export const blankAdapter: ProjectTemplateAdapter = {
  type: 'blank',
  displayName: 'Blank',
  description: 'Minimal project with README.md and .gitignore',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });

    writeFileSync(join(dest, 'README.md'), `# ${name}\n`, 'utf8');
    writeFileSync(join(dest, '.gitignore'), `node_modules/\n.env\n.env.local\n`, 'utf8');
  },
};
