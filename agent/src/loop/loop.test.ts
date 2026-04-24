import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadContext } from "./load-context";
import { buildPrompt } from "./build-prompt";
import { BunFileSystem } from "./filesystem";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "wiggum-test-"));
  // Resolve symlinks (e.g. /var -> /private/var on macOS)
  return realpath(dir);
}

// ---------------------------------------------------------------------------
// loadContext
// ---------------------------------------------------------------------------

describe("loadContext", () => {
  let dir: string;
  const fs = new BunFileSystem();

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads work.md and returns its content", async () => {
    await writeFile(join(dir, "work.md"), "# Do the thing\n");
    const ctx = await loadContext(dir, fs);
    expect(ctx.workMd).toBe("# Do the thing\n");
  });

  it("throws a descriptive error when work.md is missing", async () => {
    await expect(loadContext(dir, fs)).rejects.toThrow("loadContext");
  });

  it("error message includes the missing file path", async () => {
    try {
      await loadContext(dir, fs);
    } catch (err) {
      expect(String(err)).toContain("work.md");
    }
  });

  it("returns undefined for criteria.md when it does not exist", async () => {
    await writeFile(join(dir, "work.md"), "work\n");
    const ctx = await loadContext(dir, fs);
    expect(ctx.criteriaMd).toBeUndefined();
  });

  it("returns undefined for todo.md when it does not exist", async () => {
    await writeFile(join(dir, "work.md"), "work\n");
    const ctx = await loadContext(dir, fs);
    expect(ctx.todoMd).toBeUndefined();
  });

  it("reads criteria.md when it exists", async () => {
    await writeFile(join(dir, "work.md"), "work\n");
    await writeFile(join(dir, "criteria.md"), "- done\n");
    const ctx = await loadContext(dir, fs);
    expect(ctx.criteriaMd).toBe("- done\n");
  });

  it("reads todo.md when it exists", async () => {
    await writeFile(join(dir, "work.md"), "work\n");
    await writeFile(join(dir, "todo.md"), "- [ ] step one\n");
    const ctx = await loadContext(dir, fs);
    expect(ctx.todoMd).toBe("- [ ] step one\n");
  });

  it("reads all three files when all exist", async () => {
    await writeFile(join(dir, "work.md"), "W");
    await writeFile(join(dir, "criteria.md"), "C");
    await writeFile(join(dir, "todo.md"), "T");
    const ctx = await loadContext(dir, fs);
    expect(ctx.workMd).toBe("W");
    expect(ctx.criteriaMd).toBe("C");
    expect(ctx.todoMd).toBe("T");
  });

  it("returns undefined for userNotesMd when user-notes.md does not exist", async () => {
    await writeFile(join(dir, "work.md"), "work\n");
    const ctx = await loadContext(dir, fs);
    expect(ctx.userNotesMd).toBeUndefined();
  });

  it("reads user-notes.md when it exists", async () => {
    await writeFile(join(dir, "work.md"), "work\n");
    await writeFile(join(dir, "user-notes.md"), "please focus on performance\n");
    const ctx = await loadContext(dir, fs);
    expect(ctx.userNotesMd).toBe("please focus on performance\n");
  });
});

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

describe("buildPrompt", () => {
  it("includes work.md content", () => {
    const prompt = buildPrompt({ workMd: "do the work", criteriaMd: undefined, todoMd: undefined });
    expect(prompt).toContain("do the work");
  });

  it("includes criteria.md content when present", () => {
    const prompt = buildPrompt({ workMd: "W", criteriaMd: "done when X", todoMd: undefined });
    expect(prompt).toContain("done when X");
  });

  it("includes todo.md content when present", () => {
    const prompt = buildPrompt({ workMd: "W", criteriaMd: undefined, todoMd: "- [ ] step" });
    expect(prompt).toContain("- [ ] step");
  });

  it("does not include criteria section header when criteriaMd is undefined", () => {
    const prompt = buildPrompt({ workMd: "W", criteriaMd: undefined, todoMd: undefined });
    expect(prompt).not.toContain("criteria.md");
  });

  it("does not include todo section header when todoMd is undefined", () => {
    const prompt = buildPrompt({ workMd: "W", criteriaMd: undefined, todoMd: undefined });
    expect(prompt).not.toContain("todo.md");
  });

  it("returns a non-empty string", () => {
    const prompt = buildPrompt({ workMd: "W", criteriaMd: undefined, todoMd: undefined });
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("includes User Notes section when userNotesMd is set", () => {
    const prompt = buildPrompt({ workMd: "W", criteriaMd: undefined, todoMd: undefined, userNotesMd: "focus on speed" });
    expect(prompt).toContain("## User Notes");
    expect(prompt).toContain("focus on speed");
  });

  it("does not include User Notes section when userNotesMd is undefined", () => {
    const prompt = buildPrompt({ workMd: "W", criteriaMd: undefined, todoMd: undefined, userNotesMd: undefined });
    expect(prompt).not.toContain("User Notes");
  });

  it("does not include User Notes section when userNotesMd is empty string", () => {
    const prompt = buildPrompt({ workMd: "W", criteriaMd: undefined, todoMd: undefined, userNotesMd: "" });
    expect(prompt).not.toContain("User Notes");
  });
});

// ---------------------------------------------------------------------------
// runIteration — integration (real temp dir, but claude is not invoked to
// avoid requiring it in the test environment; we test the subprocess command
// construction via a spy approach using a fake claude script)
// ---------------------------------------------------------------------------

describe("runIteration (integration)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
    await writeFile(join(dir, "work.md"), "# Test work\nDo something.\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("invokes claude with --dangerously-skip-permissions --output-format json", async () => {
    // Write a fake "claude" script that records its args and exits 0
    const fakeBinDir = join(dir, "fake-bin");
    await mkdir(fakeBinDir);
    const argsFile = join(dir, "claude-args.txt");
    const fakeClaude = join(fakeBinDir, "claude");
    await writeFile(
      fakeClaude,
      `#!/usr/bin/env bash\necho "$@" > "${argsFile}"\n`,
    );
    await Bun.file(fakeClaude); // ensure it exists
    // Make executable
    const chmod = Bun.spawn(["chmod", "+x", fakeClaude]);
    await chmod.exited;

    // Import runIteration with the fake claude passed via ClaudeAdapter constructor
    const { runIteration } = await import("./index");
    const { ClaudeAdapter } = await import("./adapters/claude");
    const result = await runIteration(dir, { agentAdapter: new ClaudeAdapter(undefined, fakeClaude) });
    expect(result.exitCode).toBe(0);

    const recorded = await Bun.file(argsFile).text();
    expect(recorded).toContain("--dangerously-skip-permissions");
    expect(recorded).toContain("--output-format");
    expect(recorded).toContain("json");
  });

  it("passes the work directory as cwd to claude", async () => {
    const fakeBinDir = join(dir, "fake-bin");
    await mkdir(fakeBinDir);
    const cwdFile = join(dir, "claude-cwd.txt");
    const fakeClaude = join(fakeBinDir, "claude");
    await writeFile(
      fakeClaude,
      `#!/usr/bin/env bash\npwd > "${cwdFile}"\n`,
    );
    const chmod = Bun.spawn(["chmod", "+x", fakeClaude]);
    await chmod.exited;

    const { runIteration } = await import("./index");
    const { ClaudeAdapter } = await import("./adapters/claude");
    await runIteration(dir, { agentAdapter: new ClaudeAdapter(undefined, fakeClaude) });

    const recorded = (await Bun.file(cwdFile).text()).trim();
    expect(recorded).toBe(dir);
  });

  it("throws a descriptive error when work.md is missing", async () => {
    const emptyDir = await makeTempDir();
    try {
      const { runIteration } = await import("./index");
      await expect(runIteration(emptyDir)).rejects.toThrow("work.md");
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});
