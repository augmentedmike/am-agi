import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

const spec: TemplateSpec = {
  type: 'am-board',
  displayName: 'AM Board',
  description: 'AM autonomous agent project with Kanban board, criteria-driven workflow, and CLI tooling',
  pipeline: {
    columns: [
      { id: 'backlog', label: 'Backlog' },
      { id: 'in-progress', label: 'In Progress' },
      { id: 'in-review', label: 'In Review' },
      { id: 'shipped', label: 'Shipped' },
    ],
    transitions: [
      { from: 'backlog', to: 'in-progress', gates: ['criteria.md written', 'context gathered'] },
      { from: 'in-progress', to: 'in-review', gates: ['all criteria have implementation', 'tests pass'] },
      { from: 'in-review', to: 'shipped', gates: ['all criteria verified', 'tests pass'] },
      { from: 'in-review', to: 'in-progress', gates: ['verification failed — log failure'] },
    ],
  },
  cardTypes: [
    { id: 'task', label: 'Task', fields: [] },
    { id: 'bug', label: 'Bug', fields: [] },
    { id: 'feature', label: 'Feature', fields: [] },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text', required: true },
    { id: 'description', label: 'Description', type: 'textarea' },
  ],
};

export const amBoardAdapter: ProjectTemplateAdapter = {
  type: 'am-board',
  displayName: 'AM Board',
  description: 'AM autonomous agent project with Kanban board, criteria-driven workflow, and CLI tooling',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });

    writeFileSync(
      join(dest, 'CLAUDE.md'),
      `# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Bootstrap

**Run this first, every session:**

\`\`\`sh
source ./init.sh
\`\`\`

This adds \`$HOME/am/bin\` to \`PATH\` and makes the CLI commands executable.

## Project: ${name}

## Workflow

1. Read \`todo.md\` for current checklist
2. Read \`work.md\` for task definition
3. Read \`criteria.md\` for acceptance criteria
4. Implement, test, commit after each unit of work
5. Move card through backlog → in-progress → in-review → shipped
`,
      'utf8',
    );

    writeFileSync(
      join(dest, 'work.md'),
      `# ${name}

## Description

_Describe the work to be done here._

## Goals

- [ ] Define primary goal
- [ ] Define secondary goals

## Notes

_Add any relevant context, links, or constraints._
`,
      'utf8',
    );

    writeFileSync(
      join(dest, 'init.sh'),
      `#!/usr/bin/env bash
# Bootstrap script — run once per session
export PATH="$HOME/am/bin:$PATH"
chmod +x "$HOME/am/bin/"* 2>/dev/null || true
echo "AM environment ready."
`,
      'utf8',
    );

    writeFileSync(
      join(dest, 'README.md'),
      `# ${name}

An AM autonomous agent project.

## Getting Started

\`\`\`sh
source ./init.sh
\`\`\`

## Workflow

Cards move through: \`backlog → in-progress → in-review → shipped\`

| Command | Description |
|---|---|
| \`board create --title <title>\` | Create a new card |
| \`board move <id> <state>\` | Transition a card |
| \`board show <id>\` | View card details |
| \`board search\` | List all cards |
`,
      'utf8',
    );

    writeFileSync(
      join(dest, '.gitignore'),
      `node_modules/
dist/
.env
*.tsbuildinfo
.DS_Store
`,
      'utf8',
    );
  },
};
