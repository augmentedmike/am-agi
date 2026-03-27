import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

// Platform detection
const IS_WINDOWS = process.platform === 'win32';
const IS_UNIX    = !IS_WINDOWS;
const GIT_BASH   = 'C:\\Program Files\\Git\\bin\\bash.exe';
const HAS_GIT_BASH = IS_WINDOWS && fs.existsSync(GIT_BASH);

// Derive repo root via git — works from any cwd or worktree depth.
const AM_ROOT    = execSync('git rev-parse --show-toplevel', { cwd: import.meta.dir, encoding: 'utf8' }).trim();
const VAULT_BASH = path.join(AM_ROOT, 'bin/vault');      // macOS / Linux / Git Bash
const VAULT_PS1  = path.join(AM_ROOT, 'bin/vault.ps1'); // Windows native only

// Each test gets an isolated tmp dir for both secrets and keys
let tmpDir: string;
let vaultDir: string;
let keyDir: string;

function vaultEnv() {
  return {
    ...process.env,
    VAULT_DIR_OVERRIDE: vaultDir,
    VAULT_KEY_DIR_OVERRIDE: keyDir,
  };
}

async function vault(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  let cmd: string[];
  if (!IS_WINDOWS || HAS_GIT_BASH) {
    // macOS, Linux, or Windows with Git Bash — use bash vault
    const shell = HAS_GIT_BASH ? GIT_BASH : '/bin/bash';
    cmd = [shell, VAULT_BASH, ...args];
  } else {
    // Windows native — use PowerShell vault.ps1
    cmd = ['powershell', '-ExecutionPolicy', 'Bypass', '-File', VAULT_PS1, ...args];
  }
  const proc = Bun.spawn(cmd, {
    env: vaultEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

beforeEach(() => {
  tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'am-vault-test-'));
  vaultDir = path.join(tmpDir, 'vault');
  keyDir   = path.join(tmpDir, 'keys');
  fs.mkdirSync(vaultDir, { recursive: true });
  fs.mkdirSync(keyDir,   { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('vault init', () => {
  it('generates private and public key files', async () => {
    const { exitCode } = await vault('init');
    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(keyDir, 'am_vault'))).toBe(true);
    expect(fs.existsSync(path.join(keyDir, 'am_vault.pub'))).toBe(true);
  });

  it('private key contains age secret key marker', async () => {
    await vault('init');
    const content = fs.readFileSync(path.join(keyDir, 'am_vault'), 'utf8');
    expect(content).toContain('AGE-SECRET-KEY');
  });

  it('public key starts with age1', async () => {
    await vault('init');
    const pub = fs.readFileSync(path.join(keyDir, 'am_vault.pub'), 'utf8').trim();
    expect(pub.startsWith('age1')).toBe(true);
  });

  it('is idempotent — second init prints existing key without overwriting', async () => {
    await vault('init');
    const keyBefore = fs.readFileSync(path.join(keyDir, 'am_vault'), 'utf8');
    const { stdout, exitCode } = await vault('init');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('already exists');
    const keyAfter = fs.readFileSync(path.join(keyDir, 'am_vault'), 'utf8');
    expect(keyAfter).toBe(keyBefore);
  });
});

describe('vault set + get', () => {
  beforeEach(async () => {
    await vault('init');
  });

  it('stores a secret and retrieves it unchanged', async () => {
    await vault('set', 'api_key', 'sk-test-12345');
    const { stdout, exitCode } = await vault('get', 'api_key');
    expect(exitCode).toBe(0);
    expect(stdout).toBe('sk-test-12345');
  });

  it('creates an .age file for the secret', async () => {
    await vault('set', 'my_token', 'tok_abc');
    expect(fs.existsSync(path.join(vaultDir, 'my_token.age'))).toBe(true);
  });

  it('.age file is not plaintext', async () => {
    await vault('set', 'secret', 'plaintext-value');
    const raw = fs.readFileSync(path.join(vaultDir, 'secret.age'), 'utf8');
    expect(raw).not.toContain('plaintext-value');
  });

  it('overwrites an existing secret', async () => {
    await vault('set', 'key', 'value-v1');
    await vault('set', 'key', 'value-v2');
    const { stdout } = await vault('get', 'key');
    expect(stdout).toBe('value-v2');
  });

  it('stores secrets with special characters', async () => {
    const special = 'p@$$w0rd!#%^&*()';
    await vault('set', 'pw', special);
    const { stdout } = await vault('get', 'pw');
    expect(stdout).toBe(special);
  });

  it('get returns non-zero for unknown key', async () => {
    const { exitCode, stderr } = await vault('get', 'nonexistent');
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('nonexistent');
  });
});

describe('vault list', () => {
  beforeEach(async () => {
    await vault('init');
  });

  it('returns empty message when vault is empty', async () => {
    const { stdout, exitCode } = await vault('list');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('empty');
  });

  it('lists stored key names', async () => {
    await vault('set', 'key_a', 'val');
    await vault('set', 'key_b', 'val');
    const { stdout } = await vault('list');
    expect(stdout).toContain('key_a');
    expect(stdout).toContain('key_b');
  });

  it('list output never contains secret values', async () => {
    await vault('set', 'secret_key', 'super-secret-value-xyz');
    const { stdout } = await vault('list');
    expect(stdout).not.toContain('super-secret-value-xyz');
  });
});

describe('vault rm', () => {
  beforeEach(async () => {
    await vault('init');
  });

  it('removes a stored secret', async () => {
    await vault('set', 'to_remove', 'value');
    const { exitCode } = await vault('rm', 'to_remove');
    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(vaultDir, 'to_remove.age'))).toBe(false);
  });

  it('get fails after rm', async () => {
    await vault('set', 'gone', 'value');
    await vault('rm', 'gone');
    const { exitCode } = await vault('get', 'gone');
    expect(exitCode).not.toBe(0);
  });

  it('rm returns non-zero for unknown key', async () => {
    const { exitCode } = await vault('rm', 'does_not_exist');
    expect(exitCode).not.toBe(0);
  });
});

describe('vault key name validation', () => {
  beforeEach(async () => {
    await vault('init');
  });

  it('rejects key names with spaces', async () => {
    const { exitCode, stderr } = await vault('set', 'bad key', 'val');
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('invalid key name');
  });

  it('rejects key names with slashes', async () => {
    const { exitCode } = await vault('set', 'bad/key', 'val');
    expect(exitCode).not.toBe(0);
  });

  it('accepts alphanumeric keys', async () => {
    const { exitCode } = await vault('set', 'valid123', 'val');
    expect(exitCode).toBe(0);
  });

  it('accepts keys with underscores and dashes', async () => {
    const { exitCode } = await vault('set', 'my-api_key', 'val');
    expect(exitCode).toBe(0);
  });
});

describe('vault check', () => {
  it('reports not ready before init', async () => {
    const { exitCode } = await vault('check');
    expect(exitCode).not.toBe(0);
  });

  it('reports ready after init', async () => {
    await vault('init');
    const { stdout, exitCode } = await vault('check');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('vault: ready');
  });

  it('shows secret count', async () => {
    await vault('init');
    await vault('set', 'k1', 'v1');
    await vault('set', 'k2', 'v2');
    const { stdout } = await vault('check');
    expect(stdout).toContain('2');
  });
});

// ── Platform invocation sanity ────────────────────────────────────────────────
// These describe blocks confirm the right binary is selected per platform.
// Each is skipped entirely when not on the target OS.

describe.skipIf(!IS_UNIX)('vault — Unix invocation (bash)', () => {
  it('bin/vault exists and is executable', () => {
    expect(fs.existsSync(VAULT_BASH)).toBe(true);
    const stat = fs.statSync(VAULT_BASH);
    expect(stat.mode & 0o111).not.toBe(0);
  });
});

describe.skipIf(!IS_WINDOWS)('vault — Windows invocation (PowerShell)', () => {
  it('bin/vault.ps1 exists', () => {
    expect(fs.existsSync(VAULT_PS1)).toBe(true);
  });

  it.skipIf(!HAS_GIT_BASH)('Git Bash is available at expected path', () => {
    expect(fs.existsSync(GIT_BASH)).toBe(true);
  });
});
