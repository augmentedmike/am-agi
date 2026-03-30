import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'ops',
  displayName: 'Operations',
  description: 'Internal ops and task orchestration — request intake to done',
  pipeline: {
    columns: [
      { id: 'request', label: 'Request' },
      { id: 'clarify', label: 'Clarify' },
      { id: 'plan', label: 'Plan' },
      { id: 'execute', label: 'Execute' },
      { id: 'review', label: 'Review' },
      { id: 'done', label: 'Done' },
    ],
    transitions: [
      { from: 'request', to: 'clarify', gates: [] },
      { from: 'clarify', to: 'plan', gates: ['owner assigned', 'definition of done written'] },
      { from: 'plan', to: 'execute', gates: ['dependencies resolved'] },
      { from: 'execute', to: 'review', gates: ['work complete'] },
      { from: 'review', to: 'done', gates: ['review or approval granted for critical ops'] },
      { from: 'review', to: 'execute', gates: ['review failed — rework required'] },
    ],
  },
  cardTypes: [
    {
      id: 'task',
      label: 'Task',
      fields: [
        { id: 'owner', label: 'Owner', type: 'text' as const },
        { id: 'team', label: 'Team', type: 'text' as const },
        { id: 'dueDate', label: 'Due Date', type: 'text' as const },
        { id: 'sop', label: 'SOP Link', type: 'text' as const },
      ],
    },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text' as const, required: true },
    { id: 'notes', label: 'Notes', type: 'textarea' as const },
  ],
};

export const opsAdapter: ProjectTemplateAdapter = {
  type: 'ops',
  displayName: 'Operations',
  description: 'Internal ops and task orchestration — request intake to done',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    writeFileSync(
      join(dest, 'README.md'),
      `# ${name}\n\nOperations pipeline — intake requests and orchestrate execution to completion.\n\n## Columns\n\n- **Request** — incoming task or ops request\n- **Clarify** — requirements and owner confirmed\n- **Plan** — dependencies resolved, approach documented\n- **Execute** — work in progress\n- **Review** — validation / approval\n- **Done** — complete\n`,
      'utf8',
    );
    writeFileSync(join(dest, '.gitignore'), `node_modules/\n.env\n.env.local\n`, 'utf8');
  },
};
