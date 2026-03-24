import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { CardState } from '../db/schema';

export type GateResult = { allowed: boolean; failures: string[] };

type Card = {
  state: CardState;
  attachments: Array<{ path: string; name: string }>;
  workDir?: string | null;
};

function findAttachment(card: Card, name: string) {
  return card.attachments.find(a => a.name === name || path.basename(a.path) === name);
}

function fileNonEmpty(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.size > 0;
  } catch {
    return false;
  }
}

export function checkGate(
  card: Card,
  targetState: CardState
): GateResult {
  const failures: string[] = [];
  const from = card.state;
  const to = targetState;

  if (from === 'backlog' && to === 'in-progress') {
    const criteria = findAttachment(card, 'criteria.md');
    if (!criteria) {
      failures.push('criteria.md not attached');
    } else if (!fileNonEmpty(criteria.path)) {
      failures.push('criteria.md is empty');
    }
    const todo = findAttachment(card, 'todo.md');
    if (!todo) {
      failures.push('todo.md not attached');
    } else if (!fileNonEmpty(todo.path)) {
      failures.push('todo.md is empty');
    }
  } else if (from === 'in-progress' && to === 'in-review') {
    const todo = findAttachment(card, 'todo.md');
    if (!todo) {
      failures.push('todo.md not attached');
    } else {
      const content = fs.readFileSync(todo.path, 'utf-8');
      if (/^- \[ \]/m.test(content)) {
        failures.push('todo.md has unchecked items');
      }
    }
  } else if (from === 'in-review' && to === 'shipped') {
    // Run bun test
    const workDir = card.workDir;
    if (!workDir) {
      failures.push('card has no workDir set');
    } else {
      try {
        execSync('bun test', { cwd: workDir, stdio: 'pipe' });
      } catch {
        failures.push('bun test failed');
      }

      // Check iter/<n>/agent.log exists
      const iterDir = path.join(workDir, 'iter');
      let hasIterLog = false;
      if (fs.existsSync(iterDir)) {
        const entries = fs.readdirSync(iterDir);
        hasIterLog = entries.some(e => {
          const logPath = path.join(iterDir, e, 'agent.log');
          return fs.existsSync(logPath);
        });
      }
      if (!hasIterLog) {
        failures.push('no iter/<n>/agent.log found');
      }

      // Check criteria.md has all criteria verified in latest agent.log
      const criteria = findAttachment(card, 'criteria.md');
      if (criteria && hasIterLog) {
        const iterEntries = fs.readdirSync(iterDir).sort();
        const latestIter = iterEntries[iterEntries.length - 1];
        const agentLog = fs.readFileSync(path.join(iterDir, latestIter, 'agent.log'), 'utf-8');
        const criteriaContent = fs.readFileSync(criteria.path, 'utf-8');
        const criteriaLines = criteriaContent.split('\n').filter(l => l.match(/^[-*]\s/));
        for (const line of criteriaLines) {
          const criterion = line.replace(/^[-*]\s+/, '').trim();
          if (criterion && !agentLog.includes('✓') && !agentLog.includes('[pass]')) {
            failures.push('not all criteria verified in latest agent.log');
            break;
          }
        }
      }
    }
  } else if (from === 'in-review' && to === 'in-progress') {
    // Always allowed
  } else {
    failures.push(`transition from ${from} to ${to} is not allowed`);
  }

  return { allowed: failures.length === 0, failures };
}
