import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export type WebStack =
  | 'next'
  | 'vite'
  | 'node'
  | 'django'
  | 'flask'
  | 'fastapi'
  | 'rails'
  | 'sinatra'
  | 'php'
  | 'go'
  | 'static';

function expandPath(p: string): string {
  return p.replace(/^~/, homedir());
}

function readJson(p: string): Record<string, unknown> | null {
  try { return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>; }
  catch { return null; }
}

function readText(p: string): string | null {
  try { return readFileSync(p, 'utf8'); }
  catch { return null; }
}

/**
 * Detect the web stack of a project on disk. Returns null if the project does
 * not look like something we know how to start as a web server.
 *
 * Detection order matters: more specific stacks (next, django) before generic
 * fallbacks (node, static).
 */
export function detectWebStack(repoDirInput: string | null | undefined): WebStack | null {
  if (!repoDirInput) return null;
  const repoDir = expandPath(repoDirInput);
  if (!existsSync(repoDir)) return null;

  const has = (rel: string) => existsSync(path.join(repoDir, rel));

  // ── Node ecosystem ─────────────────────────────────────────────────────────
  const pkg = readJson(path.join(repoDir, 'package.json'));
  if (pkg) {
    const deps = {
      ...(pkg.dependencies as object ?? {}),
      ...(pkg.devDependencies as object ?? {}),
    } as Record<string, string>;
    if ('next' in deps) return 'next';
    if ('vite' in deps) return 'vite';
    const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {};
    if (scripts.dev || scripts.start) return 'node';
  }

  // ── Python ─────────────────────────────────────────────────────────────────
  if (has('manage.py')) return 'django';
  const pyproject = readText(path.join(repoDir, 'pyproject.toml'));
  const requirements = readText(path.join(repoDir, 'requirements.txt'));
  const pyDeps = `${pyproject ?? ''}\n${requirements ?? ''}`.toLowerCase();
  if (pyDeps) {
    if (/\bdjango\b/.test(pyDeps)) return 'django';
    if (/\bfastapi\b/.test(pyDeps) || /\buvicorn\b/.test(pyDeps)) return 'fastapi';
    if (/\bflask\b/.test(pyDeps)) return 'flask';
  }

  // ── Ruby ───────────────────────────────────────────────────────────────────
  const gemfile = readText(path.join(repoDir, 'Gemfile'));
  if (gemfile) {
    if (/\brails\b/.test(gemfile) || has('bin/rails')) return 'rails';
    if (/\bsinatra\b/.test(gemfile)) return 'sinatra';
  }

  // ── PHP ────────────────────────────────────────────────────────────────────
  if (has('composer.json') || has('index.php')) return 'php';

  // ── Go ─────────────────────────────────────────────────────────────────────
  const goMod = readText(path.join(repoDir, 'go.mod'));
  if (goMod) {
    const lower = goMod.toLowerCase();
    if (/\b(net\/http|gin-gonic|labstack\/echo|gofiber|chi-router)\b/.test(lower)) return 'go';
  }

  // ── Static fallback ────────────────────────────────────────────────────────
  if (has('index.html') || has('public/index.html')) return 'static';

  return null;
}

/**
 * Read the dev-server command declared in the project's own manifest. Each
 * ecosystem stores its run commands in a conventional file — we read that
 * directly rather than guessing. Returns null if the project's manifest
 * doesn't declare a dev script (caller can prompt the user to set one).
 *
 * `$PORT` in the returned string is a placeholder substituted at spawn time.
 */
export function readStartCommand(repoDirInput: string | null | undefined): string | null {
  if (!repoDirInput) return null;
  const repoDir = expandPath(repoDirInput);
  if (!existsSync(repoDir)) return null;

  const has = (rel: string) => existsSync(path.join(repoDir, rel));

  // ── Procfile (Heroku convention — works for any stack) ────────────────────
  const procfile = readText(path.join(repoDir, 'Procfile'));
  if (procfile) {
    const web = procfile.split('\n').find((l) => /^\s*web\s*:/.test(l));
    if (web) return web.replace(/^\s*web\s*:\s*/, '').trim();
  }

  // ── Node: package.json scripts (dev > start), package manager from lockfile
  const pkg = readJson(path.join(repoDir, 'package.json'));
  if (pkg) {
    const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {};
    const script = scripts.dev ? 'dev' : scripts.start ? 'start' : null;
    if (script) {
      const pm = has('bun.lock') ? 'bun'
               : has('pnpm-lock.yaml') ? 'pnpm'
               : has('yarn.lock') ? 'yarn'
               : 'npm';
      return `${pm} run ${script}`;
    }
  }

  // ── Python: pyproject.toml [project.scripts] / [tool.poetry.scripts] ──────
  const pyproject = readText(path.join(repoDir, 'pyproject.toml'));
  if (pyproject) {
    const scriptKey = findTomlScript(pyproject, ['dev', 'serve', 'start', 'runserver']);
    if (scriptKey) return scriptKey;
  }

  // ── PHP: composer.json scripts ────────────────────────────────────────────
  const composer = readJson(path.join(repoDir, 'composer.json'));
  if (composer) {
    const scripts = (composer.scripts as Record<string, unknown> | undefined) ?? {};
    for (const key of ['dev', 'serve', 'start']) {
      if (key in scripts) return `composer run-script ${key}`;
    }
  }

  // ── Ruby: bin/dev (Rails 7+ convention) ──────────────────────────────────
  if (has('bin/dev')) return 'bin/dev';

  // ── Manifest-less fallbacks: only enough to launch something runnable ─────
  if (has('manage.py')) return 'python manage.py runserver 0.0.0.0:$PORT';
  if (has('bin/rails')) return 'bin/rails server -p $PORT -b 0.0.0.0';
  if (has('go.mod')) return 'go run .';
  if (has('index.html') || has('public/index.html')) return 'python3 -m http.server $PORT --bind 0.0.0.0';
  if (has('index.php')) return 'php -S 0.0.0.0:$PORT';

  return null;
}

/** Find the first matching key in a TOML [project.scripts] / [tool.poetry.scripts]
 * table and return the right invocation. Tolerant of unquoted/quoted keys and
 * either layout — we don't need a full TOML parser, just key presence. */
function findTomlScript(toml: string, keys: readonly string[]): string | null {
  // Capture the body of [project.scripts] or [tool.poetry.scripts] up to the
  // next top-level table header (`\n[`) or end of input. No `m` flag — we want
  // `$` to mean end of file, not end of line.
  const inScriptsSection = /\[(?:project|tool\.poetry)\.scripts\]([\s\S]*?)(?:\n\[|$)/.exec(toml);
  const body = inScriptsSection?.[1] ?? '';
  for (const key of keys) {
    const re = new RegExp(`^\\s*"?${key}"?\\s*=\\s*"([^"]+)"`, 'm');
    const match = re.exec(body);
    if (match) {
      // PEP 621 entry points are `module:func` — invoke via `python -m <module>`
      const value = match[1];
      if (/^[\w.]+:[\w.]+$/.test(value)) {
        return `python -m ${value.split(':')[0]}`;
      }
      return value;
    }
  }
  return null;
}
