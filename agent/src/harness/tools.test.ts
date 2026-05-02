import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "bun:test";

import { runHarnessTool } from "./tools.ts";

let tempDir: string | undefined;

async function makeTempDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), "am-cli-tools-"));
  return tempDir;
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("am-cli harness tools", () => {
  it("writes and reads workspace files", async () => {
    const workDir = await makeTempDir();
    const write = await runHarnessTool({
      id: "call-1",
      name: "write_file",
      argumentsJson: JSON.stringify({ path: "src/hello.txt", content: "hello" }),
    }, { workDir, timeoutMs: 1000 });
    expect(write.content).toContain("wrote src/hello.txt");
    expect(await readFile(join(workDir, "src/hello.txt"), "utf8")).toBe("hello");

    const read = await runHarnessTool({
      id: "call-2",
      name: "read_file",
      argumentsJson: JSON.stringify({ path: "src/hello.txt" }),
    }, { workDir, timeoutMs: 1000 });
    expect(read.content).toBe("hello");
  });

  it("blocks paths outside the workspace", async () => {
    const workDir = await makeTempDir();
    const result = await runHarnessTool({
      id: "call-1",
      name: "read_file",
      argumentsJson: JSON.stringify({ path: "../secret.txt" }),
    }, { workDir, timeoutMs: 1000 });
    expect(result.content).toContain("ERROR: path escapes workspace");
  });
});
