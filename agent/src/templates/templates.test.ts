import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getAdapter, TEMPLATE_TYPES } from './index';
import { blankAdapter } from './adapters/blank';
import { bunLibAdapter } from './adapters/bun-lib';
import { nextAppAdapter } from './adapters/next-app';
import { salesOutboundAdapter } from './adapters/sales-outbound';
import { customerSupportAdapter } from './adapters/customer-support';
import { contentMarketingAdapter } from './adapters/content-marketing';
import { amBoardAdapter } from './adapters/am-board';

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'am-template-test-'));
}

describe('getAdapter', () => {
  it('returns blank adapter', () => {
    expect(getAdapter('blank')).toBe(blankAdapter);
  });

  it('returns bun-lib adapter', () => {
    expect(getAdapter('bun-lib')).toBe(bunLibAdapter);
  });

  it('returns next-app adapter', () => {
    expect(getAdapter('next-app')).toBe(nextAppAdapter);
  });

  it('returns sales-outbound adapter', () => {
    expect(getAdapter('sales-outbound')).toBe(salesOutboundAdapter);
  });

  it('returns customer-support adapter', () => {
    expect(getAdapter('customer-support')).toBe(customerSupportAdapter);
  });

  it('returns content-marketing adapter', () => {
    expect(getAdapter('content-marketing')).toBe(contentMarketingAdapter);
  });

  it('returns am-board adapter', () => {
    expect(getAdapter('am-board')).toBe(amBoardAdapter);
  });

  it('throws for unknown type', () => {
    expect(() => getAdapter('unknown-type')).toThrow('Unknown template type');
  });
});

describe('blank adapter', () => {
  let dest: string;

  afterEach(() => {
    try { rmSync(dest, { recursive: true, force: true }); } catch {}
  });

  it('scaffolds README.md and .gitignore', () => {
    dest = tmpDir();
    blankAdapter.scaffold('my-project', dest);
    expect(existsSync(join(dest, 'README.md'))).toBe(true);
    expect(existsSync(join(dest, '.gitignore'))).toBe(true);
  });

  it('README contains project name', () => {
    dest = tmpDir();
    blankAdapter.scaffold('my-project', dest);
    const readme = Bun.file(join(dest, 'README.md'));
    expect(readme.size).toBeGreaterThan(0);
  });
});

describe('bun-lib adapter', () => {
  let dest: string;

  afterEach(() => {
    try { rmSync(dest, { recursive: true, force: true }); } catch {}
  });

  it('scaffolds required files', () => {
    dest = tmpDir();
    bunLibAdapter.scaffold('my-lib', dest);
    expect(existsSync(join(dest, 'package.json'))).toBe(true);
    expect(existsSync(join(dest, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'index.ts'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'index.test.ts'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    dest = tmpDir();
    bunLibAdapter.scaffold('my-lib', dest);
    const pkg = await Bun.file(join(dest, 'package.json')).json();
    expect(pkg.name).toBe('my-lib');
  });
});

describe('next-app adapter', () => {
  let dest: string;

  afterEach(() => {
    try { rmSync(dest, { recursive: true, force: true }); } catch {}
  });

  it('scaffolds required files', () => {
    dest = tmpDir();
    nextAppAdapter.scaffold('my-app', dest);
    expect(existsSync(join(dest, 'package.json'))).toBe(true);
    expect(existsSync(join(dest, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(dest, 'next.config.ts'))).toBe(true);
    expect(existsSync(join(dest, 'postcss.config.mjs'))).toBe(true);
    expect(existsSync(join(dest, 'vercel.json'))).toBe(true);
    expect(existsSync(join(dest, '.gitignore'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'globals.css'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'layout.tsx'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'page.tsx'))).toBe(true);
  });

  it('package.json has correct name and next dependency', async () => {
    dest = tmpDir();
    nextAppAdapter.scaffold('my-app', dest);
    const pkg = await Bun.file(join(dest, 'package.json')).json();
    expect(pkg.name).toBe('my-app');
    expect(pkg.dependencies.next).toBeDefined();
  });
});

describe('sales-outbound adapter', () => {
  let dest: string;

  afterEach(() => {
    try { rmSync(dest, { recursive: true, force: true }); } catch {}
  });

  it('type matches registry key', () => {
    expect(salesOutboundAdapter.type).toBe('sales-outbound');
  });

  it('has a non-empty displayName', () => {
    expect(typeof salesOutboundAdapter.displayName).toBe('string');
    expect(salesOutboundAdapter.displayName.length).toBeGreaterThan(0);
  });

  it('spec has exactly 7 pipeline columns with correct IDs', () => {
    const columns = salesOutboundAdapter.spec.pipeline.columns;
    expect(columns).toHaveLength(7);
    const ids = columns.map((c) => c.id);
    expect(ids).toEqual([
      'lead',
      'contacted',
      'qualified',
      'proposal',
      'negotiating',
      'won',
      'lost',
    ]);
  });

  it('spec.cardTypes includes lead type with company, title, email fields', () => {
    const lead = salesOutboundAdapter.spec.cardTypes.find((ct) => ct.id === 'lead');
    expect(lead).toBeDefined();
    const fieldIds = lead!.fields.map((f) => f.id);
    expect(fieldIds).toContain('company');
    expect(fieldIds).toContain('title');
    expect(fieldIds).toContain('email');
  });

  it('scaffolds required files', () => {
    dest = tmpDir();
    salesOutboundAdapter.scaffold('my-sales', dest);
    expect(existsSync(join(dest, 'package.json'))).toBe(true);
    expect(existsSync(join(dest, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(dest, 'next.config.ts'))).toBe(true);
    expect(existsSync(join(dest, 'postcss.config.mjs'))).toBe(true);
    expect(existsSync(join(dest, 'vercel.json'))).toBe(true);
    expect(existsSync(join(dest, '.gitignore'))).toBe(true);
    expect(existsSync(join(dest, '.env.example'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'globals.css'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'layout.tsx'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'page.tsx'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'api', 'chat', 'route.ts'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'components', 'LeadTable.tsx'))).toBe(true);
  });

  it('package.json has correct name and @anthropic-ai/sdk', async () => {
    dest = tmpDir();
    salesOutboundAdapter.scaffold('my-sales', dest);
    const pkg = await Bun.file(join(dest, 'package.json')).json();
    expect(pkg.name).toBe('my-sales');
    expect(pkg.dependencies['@anthropic-ai/sdk']).toBeDefined();
  });
});

describe('customer-support adapter', () => {
  let dest: string;

  afterEach(() => {
    try { rmSync(dest, { recursive: true, force: true }); } catch {}
  });

  it('type matches registry key', () => {
    expect(customerSupportAdapter.type).toBe('customer-support');
  });

  it('has a non-empty displayName', () => {
    expect(typeof customerSupportAdapter.displayName).toBe('string');
    expect(customerSupportAdapter.displayName.length).toBeGreaterThan(0);
  });

  it('spec is defined with pipeline and cardTypes', () => {
    expect(customerSupportAdapter.spec).toBeDefined();
    expect(customerSupportAdapter.spec.pipeline.columns.length).toBeGreaterThan(0);
    expect(customerSupportAdapter.spec.cardTypes).toBeDefined();
  });

  it('scaffolds required files', () => {
    dest = tmpDir();
    customerSupportAdapter.scaffold('my-support', dest);
    expect(existsSync(join(dest, 'package.json'))).toBe(true);
    expect(existsSync(join(dest, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(dest, 'next.config.ts'))).toBe(true);
    expect(existsSync(join(dest, 'postcss.config.mjs'))).toBe(true);
    expect(existsSync(join(dest, 'vercel.json'))).toBe(true);
    expect(existsSync(join(dest, '.gitignore'))).toBe(true);
    expect(existsSync(join(dest, '.env.example'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'globals.css'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'layout.tsx'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'page.tsx'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'api', 'chat', 'route.ts'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'components', 'TicketList.tsx'))).toBe(true);
  });

  it('package.json has correct name and @anthropic-ai/sdk', async () => {
    dest = tmpDir();
    customerSupportAdapter.scaffold('my-support', dest);
    const pkg = await Bun.file(join(dest, 'package.json')).json();
    expect(pkg.name).toBe('my-support');
    expect(pkg.dependencies['@anthropic-ai/sdk']).toBeDefined();
  });
});

describe('content-marketing adapter', () => {
  let dest: string;

  afterEach(() => {
    try { rmSync(dest, { recursive: true, force: true }); } catch {}
  });

  it('type matches registry key', () => {
    expect(contentMarketingAdapter.type).toBe('content-marketing');
  });

  it('has a non-empty displayName', () => {
    expect(typeof contentMarketingAdapter.displayName).toBe('string');
    expect(contentMarketingAdapter.displayName.length).toBeGreaterThan(0);
  });

  it('spec is defined with pipeline and cardTypes', () => {
    expect(contentMarketingAdapter.spec).toBeDefined();
    expect(contentMarketingAdapter.spec.pipeline.columns.length).toBeGreaterThan(0);
    expect(contentMarketingAdapter.spec.cardTypes).toBeDefined();
  });

  it('scaffolds required files', () => {
    dest = tmpDir();
    contentMarketingAdapter.scaffold('my-content', dest);
    expect(existsSync(join(dest, 'package.json'))).toBe(true);
    expect(existsSync(join(dest, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(dest, 'next.config.ts'))).toBe(true);
    expect(existsSync(join(dest, 'postcss.config.mjs'))).toBe(true);
    expect(existsSync(join(dest, 'vercel.json'))).toBe(true);
    expect(existsSync(join(dest, '.gitignore'))).toBe(true);
    expect(existsSync(join(dest, '.env.example'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'globals.css'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'layout.tsx'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'page.tsx'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'app', 'api', 'chat', 'route.ts'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'components', 'ContentCalendar.tsx'))).toBe(true);
  });

  it('package.json has correct name and @anthropic-ai/sdk', async () => {
    dest = tmpDir();
    contentMarketingAdapter.scaffold('my-content', dest);
    const pkg = await Bun.file(join(dest, 'package.json')).json();
    expect(pkg.name).toBe('my-content');
    expect(pkg.dependencies['@anthropic-ai/sdk']).toBeDefined();
  });

  it('displayName is Content Marketing', () => {
    expect(contentMarketingAdapter.displayName).toBe('Content Marketing');
  });

  it('spec is defined', () => {
    expect(contentMarketingAdapter.spec).toBeDefined();
  });

  it('spec.type is content-marketing', () => {
    expect(contentMarketingAdapter.spec.type).toBe('content-marketing');
  });

  it('spec.pipeline.columns has length 7', () => {
    expect(contentMarketingAdapter.spec.pipeline.columns.length).toBe(7);
  });

  it('spec.pipeline.columns has correct IDs in order', () => {
    const ids = contentMarketingAdapter.spec.pipeline.columns.map((c) => c.id);
    expect(ids).toEqual(['idea', 'keyword-validation', 'outline', 'draft', 'edit', 'publish', 'refresh']);
  });

  it('spec.pipeline.transitions has at least 6 forward transitions', () => {
    expect(contentMarketingAdapter.spec.pipeline.transitions.length).toBeGreaterThanOrEqual(6);
  });

  it('spec.cardTypes contains article type', () => {
    const ids = contentMarketingAdapter.spec.cardTypes.map((ct) => ct.id);
    expect(ids).toContain('article');
  });

  it('spec.fields has title field with required: true', () => {
    const titleField = contentMarketingAdapter.spec.fields.find((f) => f.id === 'title');
    expect(titleField).toBeDefined();
    expect(titleField?.required).toBe(true);
  });

  it('spec.fields has type field of select with article and social options', () => {
    const typeField = contentMarketingAdapter.spec.fields.find((f) => f.id === 'type');
    expect(typeField).toBeDefined();
    expect(typeField?.type).toBe('select');
    expect(typeField?.options).toContain('article');
    expect(typeField?.options).toContain('social');
  });
});

describe('am-board adapter', () => {
  let dest: string;

  afterEach(() => {
    try { rmSync(dest, { recursive: true, force: true }); } catch {}
  });

  it('type is am-board', () => {
    expect(amBoardAdapter.type).toBe('am-board');
  });

  it('displayName is AM Board', () => {
    expect(amBoardAdapter.displayName).toBe('AM Board');
  });

  it('spec.pipeline.columns has exactly 4 columns', () => {
    const cols = amBoardAdapter.spec.pipeline.columns;
    expect(cols).toHaveLength(4);
    const ids = cols.map((c) => c.id);
    expect(ids).toContain('backlog');
    expect(ids).toContain('in-progress');
    expect(ids).toContain('in-review');
    expect(ids).toContain('shipped');
  });

  it('spec.pipeline.transitions has at least 4 entries', () => {
    expect(amBoardAdapter.spec.pipeline.transitions.length).toBeGreaterThanOrEqual(4);
  });

  it('spec.cardTypes includes task, bug, and feature', () => {
    const ids = amBoardAdapter.spec.cardTypes.map((ct) => ct.id);
    expect(ids).toContain('task');
    expect(ids).toContain('bug');
    expect(ids).toContain('feature');
  });

  it('scaffolds required files', () => {
    dest = tmpDir();
    amBoardAdapter.scaffold('my-am-project', dest);
    expect(existsSync(join(dest, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(dest, 'work.md'))).toBe(true);
    expect(existsSync(join(dest, 'init.sh'))).toBe(true);
    expect(existsSync(join(dest, 'README.md'))).toBe(true);
    expect(existsSync(join(dest, '.gitignore'))).toBe(true);
  });

  it('CLAUDE.md contains project name', async () => {
    dest = tmpDir();
    amBoardAdapter.scaffold('my-am-project', dest);
    const content = await Bun.file(join(dest, 'CLAUDE.md')).text();
    expect(content).toContain('my-am-project');
  });
});
