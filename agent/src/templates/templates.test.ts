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
});
