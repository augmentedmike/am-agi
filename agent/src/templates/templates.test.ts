import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getAdapter, TEMPLATE_TYPES } from './index';
import { blankAdapter } from './adapters/blank';
import { bunLibAdapter } from './adapters/bun-lib';
import { nextAppAdapter } from './adapters/next-app';

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
