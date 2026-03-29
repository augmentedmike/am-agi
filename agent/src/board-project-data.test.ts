/**
 * Tests for `board project cards` and `board project chat` subcommands.
 *
 * Spins up a lightweight mock HTTP server on an ephemeral port and runs the
 * board CLI binary as a subprocess with BOARD_URL pointed at it.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "node:path";
import type { Server } from "bun";

const BOARD_BIN = resolve(import.meta.dir, "../../bin/board");

// ---------------------------------------------------------------------------
// Mock server helpers
// ---------------------------------------------------------------------------

type Handler = (req: Request) => Response | Promise<Response>;

let mockHandler: Handler = () => new Response("not found", { status: 404 });

let server: Server;
let boardUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0, // ephemeral
    fetch(req) {
      return mockHandler(req);
    },
  });
  boardUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop(true);
});

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------

async function run(
  argv: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", BOARD_BIN, ...argv], {
    env: { ...process.env, BOARD_URL: boardUrl },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

// ---------------------------------------------------------------------------
// board project cards
// ---------------------------------------------------------------------------

describe("board project cards", () => {
  it("prints tabular cards when project exists and has cards (criterion 1)", async () => {
    mockHandler = (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/api/projects/proj-1/cards") {
        return Response.json([
          { id: "abc123", title: "Fix login bug", state: "in-progress", priority: "high" },
          { id: "def456", title: "Add tests", state: "backlog", priority: "normal" },
        ]);
      }
      return new Response("not found", { status: 404 });
    };

    const { stdout, exitCode } = await run(["project", "cards", "proj-1"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("ID");
    expect(stdout).toContain("TITLE");
    expect(stdout).toContain("STATE");
    expect(stdout).toContain("PRIORITY");
    expect(stdout).toContain("abc123");
    expect(stdout).toContain("Fix login bug");
    expect(stdout).toContain("in-progress");
    expect(stdout).toContain("high");
  });

  it("exits 1 with error message when project not found (criterion 2)", async () => {
    mockHandler = () => Response.json({ error: "not found" }, { status: 404 });

    const { stderr, exitCode } = await run(["project", "cards", "no-such-proj"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  it("prints (no cards) when project has no cards (criterion 3)", async () => {
    mockHandler = (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/api/projects/proj-empty/cards") {
        return Response.json([]);
      }
      return new Response("not found", { status: 404 });
    };

    const { stdout, exitCode } = await run(["project", "cards", "proj-empty"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("(no cards)");
  });
});

// ---------------------------------------------------------------------------
// board project chat (list)
// ---------------------------------------------------------------------------

describe("board project chat (list)", () => {
  it("prints TIMESTAMP / ROLE / CONTENT table (criterion 4)", async () => {
    mockHandler = (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/api/projects/proj-1/chat") {
        return Response.json([
          { id: "m1", role: "user", content: "Hello world", createdAt: "2026-01-01T00:00:00Z" },
          { id: "m2", role: "assistant", content: "Hi there", createdAt: "2026-01-01T00:00:01Z" },
        ]);
      }
      return new Response("not found", { status: 404 });
    };

    const { stdout, exitCode } = await run(["project", "chat", "proj-1"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("TIMESTAMP");
    expect(stdout).toContain("ROLE");
    expect(stdout).toContain("CONTENT");
    expect(stdout).toContain("user");
    expect(stdout).toContain("Hello world");
    expect(stdout).toContain("assistant");
  });

  it("truncates content to 80 chars (criterion 4)", async () => {
    const longContent = "x".repeat(100);
    mockHandler = (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/api/projects/proj-1/chat") {
        return Response.json([
          { id: "m1", role: "user", content: longContent, createdAt: "2026-01-01T00:00:00Z" },
        ]);
      }
      return new Response("not found", { status: 404 });
    };

    const { stdout, exitCode } = await run(["project", "chat", "proj-1"]);
    expect(exitCode).toBe(0);
    // should end with "..." (truncated at 77 + "...")
    expect(stdout).toContain("...");
    expect(stdout).not.toContain(longContent);
  });

  it("exits 1 with error when project not found (criterion 5)", async () => {
    mockHandler = () => Response.json({ error: "not found" }, { status: 404 });

    const { stderr, exitCode } = await run(["project", "chat", "no-such-proj"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  it("prints (no messages) when chat history is empty (criterion 6)", async () => {
    mockHandler = (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/api/projects/proj-empty/chat") {
        return Response.json([]);
      }
      return new Response("not found", { status: 404 });
    };

    const { stdout, exitCode } = await run(["project", "chat", "proj-empty"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("(no messages)");
  });
});

// ---------------------------------------------------------------------------
// board project chat --send
// ---------------------------------------------------------------------------

describe("board project chat --send", () => {
  it("POSTs with default role=user and prints created message id (criterion 7)", async () => {
    let capturedBody: unknown;
    mockHandler = async (req) => {
      const url = new URL(req.url);
      if (req.method === "POST" && url.pathname === "/api/projects/proj-1/chat") {
        capturedBody = await req.json();
        return Response.json({ id: "new-msg-id", role: "user", content: "Hello" }, { status: 201 });
      }
      return new Response("not found", { status: 404 });
    };

    const { stdout, exitCode } = await run([
      "project", "chat", "proj-1", "--send", "--content", "Hello",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("new-msg-id");
    expect((capturedBody as { role: string }).role).toBe("user");
    expect((capturedBody as { content: string }).content).toBe("Hello");
  });

  it("POSTs with specified role when --role is provided (criterion 8)", async () => {
    let capturedBody: unknown;
    mockHandler = async (req) => {
      const url = new URL(req.url);
      if (req.method === "POST" && url.pathname === "/api/projects/proj-1/chat") {
        capturedBody = await req.json();
        return Response.json({ id: "msg-2", role: "system", content: "ctx" }, { status: 201 });
      }
      return new Response("not found", { status: 404 });
    };

    const { stdout, exitCode } = await run([
      "project", "chat", "proj-1", "--send", "--role", "system", "--content", "ctx",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("msg-2");
    expect((capturedBody as { role: string }).role).toBe("system");
  });

  it("exits 1 with usage message when --content is missing (criterion 9)", async () => {
    mockHandler = () => new Response("not reached", { status: 500 });

    const { stderr, exitCode } = await run(["project", "chat", "proj-1", "--send"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--content");
  });
});

// ---------------------------------------------------------------------------
// Usage / die messages
// ---------------------------------------------------------------------------

describe("usage strings", () => {
  it("unknown project subcommand message lists cards and chat (criterion 10)", async () => {
    mockHandler = () => new Response("not reached", { status: 500 });

    const { stderr, exitCode } = await run(["project", "bogus-sub"]);
    expect(exitCode).toBeGreaterThanOrEqual(1);
    expect(stderr).toContain("cards");
    expect(stderr).toContain("chat");
  });

  it("main usage string includes project (criterion 11)", async () => {
    const { stderr, exitCode } = await run([]);
    expect(exitCode).toBeGreaterThanOrEqual(1);
    expect(stderr).toContain("project");
  });
});
