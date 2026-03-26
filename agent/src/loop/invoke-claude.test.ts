import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { invokeClaude, AuthError } from "./invoke-claude";

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "invoke-claude-test-"));
  return realpath(dir);
}

async function makeFakeClaude(dir: string, script: string): Promise<string> {
  const binDir = join(dir, "fake-bin");
  await mkdir(binDir, { recursive: true });
  const fakePath = join(binDir, "claude");
  await writeFile(fakePath, `#!/usr/bin/env bash\n${script}\n`);
  const chmod = Bun.spawn(["chmod", "+x", fakePath]);
  await chmod.exited;
  return fakePath;
}

describe("AuthError", () => {
  it("is an instance of Error", () => {
    const err = new AuthError();
    expect(err).toBeInstanceOf(Error);
  });

  it("has name AuthError", () => {
    const err = new AuthError();
    expect(err.name).toBe("AuthError");
  });

  it("uses default message when none given", () => {
    const err = new AuthError();
    expect(err.message).toBeTruthy();
  });

  it("uses the provided message", () => {
    const err = new AuthError("custom message");
    expect(err.message).toBe("custom message");
  });
});

describe("invokeClaude — auth error detection", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    // Create a minimal work.md so invokeClaude has a valid cwd
    await writeFile(join(dir, "work.md"), "# Test\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("throws AuthError when stderr contains 'Not logged in'", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "Not logged in · Please run /login" >&2\nexit 1`,
    );

    await expect(
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("AuthError message mentions /login", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "Not logged in · Please run /login" >&2\nexit 1`,
    );

    let caught: Error | undefined;
    try {
      await invokeClaude(dir, "hello", { claudePath: fakeClaude });
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeDefined();
    expect(caught?.message).toContain("/login");
  });

  it("does NOT throw AuthError on non-auth stderr", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "some other warning" >&2\necho "{}"\nexit 0`,
    );

    await expect(
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
    ).resolves.toBeDefined();
  });

  it("returns ClaudeResult on success with no auth error", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo '{"result":"ok"}'\nexit 0`,
    );

    const result = await invokeClaude(dir, "hello", { claudePath: fakeClaude });
    expect(result.exitCode).toBe(0);
    expect(result.result).toContain("ok");
  });

  it("returns ClaudeResult even on non-zero exit without auth string", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "claude crashed" >&2\nexit 2`,
    );

    const result = await invokeClaude(dir, "hello", { claudePath: fakeClaude });
    expect(result.exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// invokeClaude — mid-stream auth error detection (criterion 2)
// ---------------------------------------------------------------------------

describe("invokeClaude — mid-stream auth error detection", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Test\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("throws AuthError on non-zero exit with 'authentication' in stderr", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "authentication failed" >&2\nexit 1`,
    );

    await expect(
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError on non-zero exit with 'unauthorized' in stderr", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "unauthorized: invalid session" >&2\nexit 1`,
    );

    await expect(
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError on non-zero exit with '401' in stderr", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "Error 401: token rejected" >&2\nexit 1`,
    );

    await expect(
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError on non-zero exit with 'token expired' in stderr", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "token expired" >&2\nexit 1`,
    );

    await expect(
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("does NOT throw AuthError on non-zero exit with unrelated stderr", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "some transient crash" >&2\nexit 1`,
    );

    // Should NOT throw AuthError — exits non-zero but no auth pattern
    const result = await invokeClaude(dir, "hello", { claudePath: fakeClaude });
    expect(result.exitCode).toBe(1);
  });

  it("does NOT throw AuthError when exit code is 0 even with auth-like stderr", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "oauth token used" >&2\necho "{}"\nexit 0`,
    );

    const result = await invokeClaude(dir, "hello", { claudePath: fakeClaude });
    expect(result.exitCode).toBe(0);
  });

  it("mid-stream AuthError message mentions /login", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "unauthorized access" >&2\nexit 1`,
    );

    let caught: Error | undefined;
    try {
      await invokeClaude(dir, "hello", { claudePath: fakeClaude });
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeInstanceOf(AuthError);
    expect(caught?.message).toContain("/login");
  });
});
