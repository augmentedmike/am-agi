import { describe, it, expect, mock, beforeEach, afterEach, afterAll } from "bun:test";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

// --- helpers to build a fake ChildProcess ---

interface FakeProcessOptions {
  stdoutData?: string;
  stderrData?: string;
  exitCode?: number;
}

function makeFakeProcess(opts: FakeProcessOptions = {}): ChildProcess {
  const stdout = new EventEmitter() as NodeJS.ReadableStream & EventEmitter;
  const stderr = new EventEmitter() as NodeJS.ReadableStream & EventEmitter;
  const proc = new EventEmitter() as ChildProcess;
  (proc as unknown as Record<string, unknown>).stdout = stdout;
  (proc as unknown as Record<string, unknown>).stderr = stderr;

  // Emit data asynchronously so listeners are attached first
  setImmediate(() => {
    if (opts.stdoutData) stdout.emit("data", Buffer.from(opts.stdoutData));
    stdout.emit("end");
    if (opts.stderrData) stderr.emit("data", Buffer.from(opts.stderrData));
    stderr.emit("end");
    proc.emit("close", opts.exitCode ?? 0);
  });

  return proc;
}

// --- mock child_process ---

let spawnMock = mock((_cmd: string, _args: string[], _opts: unknown) => makeFakeProcess());

mock.module("node:child_process", () => ({
  spawn: (...args: Parameters<typeof spawnMock>) => spawnMock(...args),
  // execFileSync is used only for `which` resolution — return the name unchanged
  execFileSync: (_cmd: string, args: string[]) => args[0] + "\n",
}));

// Import AFTER mocking so the module picks up our mock
const { invokeClaude, AuthError } = await import("./nextjs");

describe("nextjs adapter — invokeClaude", () => {
  beforeEach(() => {
    spawnMock = mock((_cmd: string, _args: string[], _opts: unknown) =>
      makeFakeProcess({
        stdoutData: JSON.stringify({ result: "ok", usage: { input_tokens: 10, output_tokens: 5 } }),
        exitCode: 0,
      }),
    );

    mock.module("node:child_process", () => ({
      spawn: (...args: Parameters<typeof spawnMock>) => spawnMock(...args),
      execFileSync: (_cmd: string, args: string[]) => args[0] + "\n",
    }));
  });

  it("uses child_process.spawn (not Bun.spawn)", async () => {
    let spawnCalled = false;
    spawnMock = mock((_cmd: string, _args: string[], _opts: unknown) => {
      spawnCalled = true;
      return makeFakeProcess({
        stdoutData: JSON.stringify({ result: "hello", usage: {} }),
        exitCode: 0,
      });
    });

    mock.module("node:child_process", () => ({
      spawn: (...args: Parameters<typeof spawnMock>) => spawnMock(...args),
      execFileSync: (_cmd: string, args: string[]) => args[0] + "\n",
    }));

    await invokeClaude("/tmp/test", "ping");
    expect(spawnCalled).toBe(true);
  });

  it("throws AuthError when stderr contains 'Not logged in'", async () => {
    spawnMock = mock((_cmd: string, _args: string[], _opts: unknown) =>
      makeFakeProcess({ stderrData: "Error: Not logged in\n", exitCode: 1 }),
    );
    mock.module("node:child_process", () => ({
      spawn: (...args: Parameters<typeof spawnMock>) => spawnMock(...args),
      execFileSync: (_cmd: string, args: string[]) => args[0] + "\n",
    }));

    await expect(invokeClaude("/tmp/test", "ping")).rejects.toBeInstanceOf(AuthError);
  });

  it("returns the exit code from the subprocess", async () => {
    spawnMock = mock((_cmd: string, _args: string[], _opts: unknown) =>
      makeFakeProcess({
        stdoutData: JSON.stringify({ result: "done", usage: {} }),
        exitCode: 42,
      }),
    );
    mock.module("node:child_process", () => ({
      spawn: (...args: Parameters<typeof spawnMock>) => spawnMock(...args),
      execFileSync: (_cmd: string, args: string[]) => args[0] + "\n",
    }));

    const res = await invokeClaude("/tmp/test", "ping");
    expect(res.exitCode).toBe(42);
  });

  it("returns result string from JSON envelope", async () => {
    const payload = JSON.stringify({
      result: "the answer",
      usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });
    spawnMock = mock((_cmd: string, _args: string[], _opts: unknown) =>
      makeFakeProcess({ stdoutData: payload, exitCode: 0 }),
    );
    mock.module("node:child_process", () => ({
      spawn: (...args: Parameters<typeof spawnMock>) => spawnMock(...args),
      execFileSync: (_cmd: string, args: string[]) => args[0] + "\n",
    }));

    const res = await invokeClaude("/tmp/test", "ping");
    expect(res.exitCode).toBe(0);
  });

  it("AuthError is exported with correct name", () => {
    const err = new AuthError("test");
    expect(err.name).toBe("AuthError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthError);
  });

  afterAll(() => {
    mock.restore();
  });
});
