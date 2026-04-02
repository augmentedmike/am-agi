import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, realpath, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { invokeClaude, AuthError, RateLimitError, parseRateLimitReset } from "./invoke-claude";

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

// ---------------------------------------------------------------------------
// parseRateLimitReset
// ---------------------------------------------------------------------------

describe("parseRateLimitReset", () => {
  it("returns null for non-matching text", () => {
    expect(parseRateLimitReset("some random message")).toBeNull();
    expect(parseRateLimitReset("You've hit your limit")).toBeNull();
  });

  it("parses '12pm (America/Mexico_City)' and returns a future Date", () => {
    const text = "You've hit your limit · resets 12pm (America/Mexico_City)";
    const result = parseRateLimitReset(text);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("parses '9am (America/Mexico_City)' and returns a future Date", () => {
    const text = "You've hit your limit · resets 9am (America/Mexico_City)";
    const result = parseRateLimitReset(text);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("parses '12am (America/Mexico_City)' correctly (midnight = 0h)", () => {
    const text = "You've hit your limit · resets 12am (America/Mexico_City)";
    const result = parseRateLimitReset(text);
    expect(result).toBeInstanceOf(Date);
    // midnight is a valid time
    expect(result!.getTime()).toBeGreaterThan(0);
  });

  it("parses '12pm (America/New_York)' and returns a valid Date", () => {
    const text = "You've hit your limit · resets 12pm (America/New_York)";
    const result = parseRateLimitReset(text);
    expect(result).toBeInstanceOf(Date);
  });

  it("returned date is in the future (never in the past)", () => {
    const text = "You've hit your limit · resets 12pm (America/Mexico_City)";
    const result = parseRateLimitReset(text);
    expect(result!.getTime()).toBeGreaterThan(Date.now() - 1000); // allow 1s slop
  });
});

// ---------------------------------------------------------------------------
// RateLimitError
// ---------------------------------------------------------------------------

describe("RateLimitError", () => {
  it("is an instance of Error", () => {
    const err = new RateLimitError(new Date());
    expect(err).toBeInstanceOf(Error);
  });

  it("has name RateLimitError", () => {
    const err = new RateLimitError(new Date());
    expect(err.name).toBe("RateLimitError");
  });

  it("exposes resetAt property", () => {
    const resetAt = new Date(Date.now() + 3_600_000);
    const err = new RateLimitError(resetAt);
    expect(err.resetAt).toBe(resetAt);
  });

  it("accepts a custom message", () => {
    const err = new RateLimitError(new Date(), "custom");
    expect(err.message).toBe("custom");
  });

  it("generates a default message when none given", () => {
    const err = new RateLimitError(new Date(Date.now() + 3_600_000));
    expect(err.message).toContain("resets at");
  });
});

// ---------------------------------------------------------------------------
// invokeClaude — rate limit detection
// ---------------------------------------------------------------------------

describe("invokeClaude — rate limit detection", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Test\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("throws RateLimitError when stdout contains 'You've hit your limit'", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "You've hit your limit · resets 12pm (America/Mexico_City)"\nexit 1`,
    );

    await expect(
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("throws RateLimitError when stderr contains 'You've hit your limit'", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "You've hit your limit · resets 9am (America/Mexico_City)" >&2\nexit 1`,
    );

    await expect(
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("RateLimitError.resetAt is a future Date", async () => {
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "You've hit your limit · resets 12pm (America/Mexico_City)"\nexit 1`,
    );

    let caught: RateLimitError | undefined;
    try {
      await invokeClaude(dir, "hello", { claudePath: fakeClaude });
    } catch (err) {
      caught = err as RateLimitError;
    }

    expect(caught).toBeInstanceOf(RateLimitError);
    expect(caught!.resetAt.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("RateLimitError is thrown BEFORE AuthError check (takes priority)", async () => {
    // A message containing both rate limit text and auth text should trigger RateLimitError
    const fakeClaude = await makeFakeClaude(
      dir,
      `echo "You've hit your limit · resets 12pm (America/Mexico_City)\nNot logged in" >&2\nexit 1`,
    );

    await expect(
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});

// ---------------------------------------------------------------------------
// invokeClaude — mcpConfigPath option
// ---------------------------------------------------------------------------

describe("invokeClaude — mcpConfigPath option", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Test\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("passes --mcp-config <path> to the Claude CLI when mcpConfigPath is set", async () => {
    const mcpConfigPath = join(dir, "mcp.json");
    await writeFile(mcpConfigPath, JSON.stringify({ mcpServers: {} }));

    // Fake claude: echo all args to stdout, exit 0
    const fakeClaude = await makeFakeClaude(dir, `echo "$@"\nexit 0`);

    const result = await invokeClaude(dir, "hello", { claudePath: fakeClaude, mcpConfigPath });
    expect(result.result).toContain("--mcp-config");
    expect(result.result).toContain(mcpConfigPath);
  });

  it("does NOT pass --mcp-config when mcpConfigPath is not set", async () => {
    const fakeClaude = await makeFakeClaude(dir, `echo "$@"\nexit 0`);

    const result = await invokeClaude(dir, "hello", { claudePath: fakeClaude });
    expect(result.result).not.toContain("--mcp-config");
  });
});

// ---------------------------------------------------------------------------
// invokeClaude — .agent-pid file lifecycle
// ---------------------------------------------------------------------------

describe("invokeClaude — .agent-pid file", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Test\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes .agent-pid during execution and deletes it after", async () => {
    // Fake claude: sleeps briefly to ensure the pid file is readable mid-run
    const fakeClaude = await makeFakeClaude(dir, `sleep 0.05\necho "done"\nexit 0`);

    let pidFileExistedDuringRun = false;
    const pidFilePath = join(dir, ".agent-pid");

    // Poll for the pid file in parallel with the invocation.
    // Allow up to 6s: the startup lock can hold ~4s from a previous test,
    // then the fake claude script runs briefly.
    const pollPromise = (async () => {
      for (let i = 0; i < 600; i++) {
        await new Promise(r => setTimeout(r, 10));
        try {
          await access(pidFilePath);
          pidFileExistedDuringRun = true;
          break;
        } catch { /* not yet */ }
      }
    })();

    await Promise.all([
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
      pollPromise,
    ]);

    expect(pidFileExistedDuringRun).toBe(true);

    // After completion, pid file should be gone
    let pidFileExists = true;
    try { await access(pidFilePath); } catch { pidFileExists = false; }
    expect(pidFileExists).toBe(false);
  });

  it("pid file contains a valid integer PID", async () => {
    // Fake claude: sleep long enough for us to read the pid file, then exit
    const fakeClaude = await makeFakeClaude(dir, `sleep 0.1\nexit 0`);
    const pidFilePath = join(dir, ".agent-pid");

    let pidValue: number | null = null;
    const pollPromise = (async () => {
      for (let i = 0; i < 600; i++) {
        await new Promise(r => setTimeout(r, 10));
        try {
          const contents = await readFile(pidFilePath, "utf8");
          const parsed = parseInt(contents.trim(), 10);
          if (!isNaN(parsed) && parsed > 0) {
            pidValue = parsed;
            break;
          }
        } catch { /* not yet */ }
      }
    })();

    await Promise.all([
      invokeClaude(dir, "hello", { claudePath: fakeClaude }),
      pollPromise,
    ]);

    expect(pidValue).not.toBeNull();
    expect(pidValue).toBeGreaterThan(0);
  });
});
