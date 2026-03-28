import { describe, it, expect } from "bun:test";
import { mkdtemp, writeFile, mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { invokeClaude, AuthError } from "./invoke-claude";

describe("pipedebug", () => {
  it("directly tests invokeClaude stderr capture", async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), "t-")));
    const binDir = join(dir, "bin");
    await mkdir(binDir);
    const fakePath = join(binDir, "claude");
    await writeFile(fakePath, '#!/usr/bin/env bash\necho "Not logged in · Please run /login" >&2\nexit 1\n');
    const ch = Bun.spawn(["chmod", "+x", fakePath]);
    await ch.exited;

    let threw = false;
    let error: unknown;
    try {
      await invokeClaude(dir, "hello", { claudePath: fakePath });
    } catch (e) {
      threw = true;
      error = e;
      console.log("error caught:", e instanceof AuthError ? "AuthError" : typeof e, String(e));
    }
    console.log("threw:", threw);
    expect(threw).toBe(true);
    expect(error).toBeInstanceOf(AuthError);
  });
});
