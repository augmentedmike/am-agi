import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CodexAdapter } from "./codex";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "am-codex-adapter-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("CodexAdapter", () => {
  test("invokes codex exec and reads the last message file", async () => {
    const callsPath = join(tmpDir, "calls.json");
    const fakeCodex = join(tmpDir, "codex");
    writeFileSync(
      fakeCodex,
      `#!/usr/bin/env bun
const args = Bun.argv.slice(2);
const stdin = await Bun.stdin.text();
const outputIdx = args.indexOf("--output-last-message");
if (outputIdx !== -1) {
  await Bun.write(args[outputIdx + 1], "done from codex");
}
await Bun.write("${callsPath}", JSON.stringify({ args, stdin }));
`,
      "utf8",
    );
    chmodSync(fakeCodex, 0o755);

    const adapter = new CodexAdapter("gpt-test-codex", fakeCodex);
    const result = await adapter.invoke(tmpDir, "do work", { systemPrompt: "system" });

    expect(result).toEqual({ exitCode: 0, result: "done from codex" });
    const call = JSON.parse(readFileSync(callsPath, "utf8")) as { args: string[]; stdin: string };
    expect(call.args).toContain("exec");
    expect(call.args).toContain("--model");
    expect(call.args).toContain("gpt-test-codex");
    expect(call.stdin).toContain("system");
    expect(call.stdin).toContain("do work");
  });
});
