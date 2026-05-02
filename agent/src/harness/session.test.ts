import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "bun:test";

import { type FetchLike, runAmHarness } from "./session.ts";

let tempDir: string | undefined;

async function makeWorkDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), "am-cli-session-"));
  await writeFile(join(tempDir, "work.md"), "Create hello.txt with hello from am-cli.", "utf8");
  return tempDir;
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("am-cli harness session", () => {
  it("executes model tool calls and returns the final response", async () => {
    const workDir = await makeWorkDir();
    let calls = 0;
    const fetchImpl: FetchLike = async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: unknown[]; tools?: unknown[] };
      expect(body.tools).toBeArray();

      if (calls === 1) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              content: "",
              tool_calls: [{
                id: "call-1",
                type: "function",
                function: {
                  name: "write_file",
                  arguments: JSON.stringify({ path: "hello.txt", content: "hello from am-cli" }),
                },
              }],
            },
          }],
          usage: { prompt_tokens: 10, completion_tokens: 3 },
        }), { status: 200 });
      }

      expect(JSON.stringify(body.messages)).toContain("wrote hello.txt");
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: "created hello.txt\nDONE",
          },
        }],
      }), { status: 200 });
    };

    const result = await runAmHarness({
      workDir,
      provider: "local",
      fetchImpl,
      maxSteps: 3,
    });

    expect(result.exitCode).toBe(0);
    expect(result.result).toContain("DONE");
    expect(result.steps).toBe(2);
    expect(await readFile(join(workDir, "hello.txt"), "utf8")).toBe("hello from am-cli");
  });
});
