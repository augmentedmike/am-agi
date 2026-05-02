import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectWebStack, readStartCommand } from '../web-stack';

describe('detectWebStack', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'webstack-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns null for missing or empty repoDir', () => {
    expect(detectWebStack(null)).toBe(null);
    expect(detectWebStack(undefined)).toBe(null);
    expect(detectWebStack('')).toBe(null);
    expect(detectWebStack('/this/path/does/not/exist')).toBe(null);
  });

  it('detects next from package.json deps', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '^15' } }));
    expect(detectWebStack(dir)).toBe('next');
  });

  it('detects vite from package.json devDeps', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: { vite: '^5' } }));
    expect(detectWebStack(dir)).toBe('vite');
  });

  it('detects generic node from a dev script', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
    expect(detectWebStack(dir)).toBe('node');
  });

  it('detects django from manage.py', () => {
    writeFileSync(path.join(dir, 'manage.py'), '#!/usr/bin/env python');
    expect(detectWebStack(dir)).toBe('django');
  });

  it('detects django from requirements.txt', () => {
    writeFileSync(path.join(dir, 'requirements.txt'), 'Django==5.0\n');
    expect(detectWebStack(dir)).toBe('django');
  });

  it('detects flask from requirements.txt', () => {
    writeFileSync(path.join(dir, 'requirements.txt'), 'flask==3.0\n');
    expect(detectWebStack(dir)).toBe('flask');
  });

  it('detects fastapi from pyproject.toml', () => {
    writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\ndependencies = ["fastapi"]\n');
    expect(detectWebStack(dir)).toBe('fastapi');
  });

  it('detects rails from Gemfile', () => {
    writeFileSync(path.join(dir, 'Gemfile'), 'gem "rails", "~> 7.1"\n');
    expect(detectWebStack(dir)).toBe('rails');
  });

  it('detects sinatra from Gemfile', () => {
    writeFileSync(path.join(dir, 'Gemfile'), 'gem "sinatra"\n');
    expect(detectWebStack(dir)).toBe('sinatra');
  });

  it('detects php from composer.json', () => {
    writeFileSync(path.join(dir, 'composer.json'), '{}');
    expect(detectWebStack(dir)).toBe('php');
  });

  it('detects php from index.php', () => {
    writeFileSync(path.join(dir, 'index.php'), '<?php echo "hi"; ?>');
    expect(detectWebStack(dir)).toBe('php');
  });

  it('detects go from go.mod with gin', () => {
    writeFileSync(path.join(dir, 'go.mod'), 'module x\nrequire github.com/gin-gonic/gin v1.9.0\n');
    expect(detectWebStack(dir)).toBe('go');
  });

  it('detects static from index.html', () => {
    writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    expect(detectWebStack(dir)).toBe('static');
  });

  it('detects static from public/index.html', () => {
    mkdirSync(path.join(dir, 'public'));
    writeFileSync(path.join(dir, 'public', 'index.html'), '<html></html>');
    expect(detectWebStack(dir)).toBe('static');
  });

  it('returns null when nothing matches', () => {
    writeFileSync(path.join(dir, 'README.md'), 'just docs');
    expect(detectWebStack(dir)).toBe(null);
  });

  it('expands ~ in paths', () => {
    expect(detectWebStack('~/this-also-does-not-exist')).toBe(null);
  });
});

describe('readStartCommand', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'startcmd-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns null for missing/empty repos', () => {
    expect(readStartCommand(null)).toBe(null);
    expect(readStartCommand('')).toBe(null);
    expect(readStartCommand('/nope')).toBe(null);
  });

  it('reads Procfile web: line as the highest-priority source', () => {
    writeFileSync(path.join(dir, 'Procfile'), 'web: bun run server.ts\nworker: bun run worker.ts\n');
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'next dev' } }));
    expect(readStartCommand(dir)).toBe('bun run server.ts');
  });

  it('reads package.json scripts.dev with the right package manager', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'next dev' } }));
    expect(readStartCommand(dir)).toBe('npm run dev');
  });

  it('uses bun when bun.lock is present', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'next dev' } }));
    writeFileSync(path.join(dir, 'bun.lock'), '');
    expect(readStartCommand(dir)).toBe('bun run dev');
  });

  it('uses pnpm when pnpm-lock.yaml is present', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'next dev' } }));
    writeFileSync(path.join(dir, 'pnpm-lock.yaml'), '');
    expect(readStartCommand(dir)).toBe('pnpm run dev');
  });

  it('falls back to scripts.start when scripts.dev is absent', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { start: 'node server.js' } }));
    expect(readStartCommand(dir)).toBe('npm run start');
  });

  it('reads composer.json scripts (dev > serve > start)', () => {
    writeFileSync(path.join(dir, 'composer.json'), JSON.stringify({ scripts: { serve: 'php -S localhost:8000', dev: 'php -S localhost:8001' } }));
    expect(readStartCommand(dir)).toBe('composer run-script dev');
  });

  it('reads pyproject.toml [project.scripts]', () => {
    writeFileSync(path.join(dir, 'pyproject.toml'), '[project.scripts]\ndev = "myapp.cli:dev"\n');
    expect(readStartCommand(dir)).toBe('python -m myapp.cli');
  });

  it('reads pyproject.toml [tool.poetry.scripts]', () => {
    writeFileSync(path.join(dir, 'pyproject.toml'), '[tool.poetry.scripts]\nserve = "uvicorn main:app --reload"\n');
    expect(readStartCommand(dir)).toBe('uvicorn main:app --reload');
  });

  it('uses bin/dev when present (Rails 7+ convention)', () => {
    mkdirSync(path.join(dir, 'bin'));
    writeFileSync(path.join(dir, 'bin', 'dev'), '#!/bin/sh');
    expect(readStartCommand(dir)).toBe('bin/dev');
  });

  it('falls back to django canonical when manage.py exists with no manifest', () => {
    writeFileSync(path.join(dir, 'manage.py'), '#!/usr/bin/env python');
    expect(readStartCommand(dir)).toBe('python manage.py runserver 0.0.0.0:$PORT');
  });

  it('falls back to static fallback when only index.html exists', () => {
    writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    expect(readStartCommand(dir)).toBe('python3 -m http.server $PORT --bind 0.0.0.0');
  });

  it('returns null when no manifest or fallback indicator is present', () => {
    writeFileSync(path.join(dir, 'README.md'), 'docs');
    expect(readStartCommand(dir)).toBe(null);
  });
});
