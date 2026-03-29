import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';

export const blankAdapter: ProjectTemplateAdapter = {
  type: 'blank',
  description: 'Minimal project with README.md and .gitignore',
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });

    writeFileSync(join(dest, 'README.md'), `# ${name}\n`, 'utf8');
    writeFileSync(join(dest, '.gitignore'), `node_modules/\n.env\n.env.local\n`, 'utf8');
  },
};
