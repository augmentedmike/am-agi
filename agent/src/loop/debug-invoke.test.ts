import { describe, it, expect } from "bun:test";
import { mkdtemp, writeFile, mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Inline the invokeClaude logic to debug
async function invokeDebug(workDir: string, fakePath: string) {
  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, ...spawnEnv } = process.env;
  const resolvedClaude = Bun.which(fakePath, { PATH: spawnEnv.PATH ?? process.env.PATH ?? "" }) ?? fakePath;
  
  console.log("fakePath:", fakePath);
  console.log("resolvedClaude:", resolvedClaude);
  console.log("resolvedClaude === fakePath:", resolvedClaude === fakePath);

  const args = [resolvedClaude, "--dangerously-skip-permissions", "-p", "hello", "--output-format", "json"];
  const proc = Bun.spawn(args, {
    cwd: workDir,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    env: spawnEnv,
  });

  const decoder = new TextDecoder();
  const [stdoutChunks, stderrChunks] = await Promise.all([
    (async () => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of proc.stdout as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return chunks;
    })(),
    (async () => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of proc.stderr as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return chunks;
    })(),
  ]);

  const exitCode = await proc.exited;
  const stderrText = stderrChunks.map(c => new TextDecoder().decode(c)).join("");
  const rawOutput = stdoutChunks.map(c => decoder.decode(c, { stream: true })).join("");
  
  console.log("exitCode:", exitCode);
  console.log("stderrText:", JSON.stringify(stderrText));
  console.log("rawOutput:", JSON.stringify(rawOutput));
  
  return { exitCode, stderrText, rawOutput };
}

describe("debug", () => {
  it("captures stderr from fake claude in project context", async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), "test-")));
    const binDir = join(dir, "fake-bin");
    await mkdir(binDir, { recursive: true });
    const fakePath = join(binDir, "claude");
    await writeFile(fakePath, '#!/usr/bin/env bash\necho "Not logged in · Please run /login" >&2\nexit 1\n');
    const ch = Bun.spawn(["chmod", "+x", fakePath]);
    await ch.exited;

    const result = await invokeDebug(dir, fakePath);
    expect(result.stderrText).toContain("Not logged in");
  });
});
