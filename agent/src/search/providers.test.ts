import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildMcpConfig, advanceCursor } from "./providers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "search-providers-test-"));
}

/** Save and restore env vars around a test. */
function withEnv(vars: Record<string, string | undefined>, fn: () => unknown) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ---------------------------------------------------------------------------
// buildMcpConfig
// ---------------------------------------------------------------------------

describe("buildMcpConfig — no providers", () => {
  it("returns null when no env vars are set", () => {
    const result = withEnv(
      { TAVILY_API_KEY: undefined, EXA_API_KEY: undefined, YOU_API_KEY: undefined, YOU_FREE_SEARCH: undefined },
      () => buildMcpConfig({}),
    );
    expect(result).toBeNull();
  });
});

describe("buildMcpConfig — single provider", () => {
  it("returns config with one entry for TAVILY_API_KEY", () => {
    const cfg = buildMcpConfig({ TAVILY_API_KEY: "tvly-test-key" });
    expect(cfg).not.toBeNull();
    const servers = (cfg as Record<string, unknown>).mcpServers as Record<string, unknown>;
    expect(Object.keys(servers)).toHaveLength(1);
    expect(servers["tavily-search"]).toBeDefined();
    const entry = servers["tavily-search"] as Record<string, unknown>;
    expect(entry.type).toBe("sse");
    expect(entry.url).toContain("tvly-test-key");
  });

  it("returns config with one entry for EXA_API_KEY", () => {
    const cfg = buildMcpConfig({ EXA_API_KEY: "exa-test-key" });
    expect(cfg).not.toBeNull();
    const servers = (cfg as Record<string, unknown>).mcpServers as Record<string, unknown>;
    expect(Object.keys(servers)).toHaveLength(1);
    expect(servers["exa-search"]).toBeDefined();
    const entry = servers["exa-search"] as Record<string, unknown>;
    expect(entry.type).toBe("sse");
    const headers = entry.headers as Record<string, string>;
    expect(headers.Authorization).toContain("exa-test-key");
  });

  it("returns config with one entry for YOU_FREE_SEARCH=1", () => {
    const cfg = buildMcpConfig({ YOU_FREE_SEARCH: "1" });
    expect(cfg).not.toBeNull();
    const servers = (cfg as Record<string, unknown>).mcpServers as Record<string, unknown>;
    expect(Object.keys(servers)).toHaveLength(1);
    expect(servers["you-search"]).toBeDefined();
  });
});

describe("buildMcpConfig — two providers", () => {
  it("returns config with two entries for TAVILY + EXA", () => {
    const cfg = buildMcpConfig({
      TAVILY_API_KEY: "tvly-abc",
      EXA_API_KEY: "exa-xyz",
    });
    expect(cfg).not.toBeNull();
    const servers = (cfg as Record<string, unknown>).mcpServers as Record<string, unknown>;
    expect(Object.keys(servers)).toHaveLength(2);
    expect(servers["tavily-search"]).toBeDefined();
    expect(servers["exa-search"]).toBeDefined();
  });
});

describe("buildMcpConfig — three providers", () => {
  it("returns config with three entries for TAVILY + EXA + YOU_FREE_SEARCH", () => {
    const cfg = buildMcpConfig({
      TAVILY_API_KEY: "tvly-abc",
      EXA_API_KEY: "exa-xyz",
      YOU_FREE_SEARCH: "1",
    });
    expect(cfg).not.toBeNull();
    const servers = (cfg as Record<string, unknown>).mcpServers as Record<string, unknown>;
    expect(Object.keys(servers)).toHaveLength(3);
    expect(servers["tavily-search"]).toBeDefined();
    expect(servers["exa-search"]).toBeDefined();
    expect(servers["you-search"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// advanceCursor
// ---------------------------------------------------------------------------

describe("advanceCursor", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns first provider on first call when cursor absent", () => {
    const result = withEnv(
      { TAVILY_API_KEY: "tvly-abc", EXA_API_KEY: "exa-xyz", YOU_API_KEY: undefined, YOU_FREE_SEARCH: undefined },
      () => advanceCursor(dir),
    );
    expect(result).toBe("tavily-search");
  });

  it("advances cursor on each call (round-robin)", () => {
    const calls: string[] = [];
    withEnv(
      { TAVILY_API_KEY: "tvly-abc", EXA_API_KEY: "exa-xyz", YOU_API_KEY: undefined, YOU_FREE_SEARCH: undefined },
      () => {
        calls.push(advanceCursor(dir)); // cursor 0 → tavily
        calls.push(advanceCursor(dir)); // cursor 1 → exa
        calls.push(advanceCursor(dir)); // cursor 2 → tavily (wraps)
      },
    );
    expect(calls).toEqual(["tavily-search", "exa-search", "tavily-search"]);
  });

  it("wraps around correctly via modulo", () => {
    const calls: string[] = [];
    withEnv(
      { TAVILY_API_KEY: "tvly-abc", EXA_API_KEY: "exa-xyz", YOU_FREE_SEARCH: "1", YOU_API_KEY: undefined },
      () => {
        for (let i = 0; i < 6; i++) calls.push(advanceCursor(dir));
      },
    );
    // 3 providers: T, E, Y, T, E, Y
    expect(calls).toEqual([
      "tavily-search",
      "exa-search",
      "you-search",
      "tavily-search",
      "exa-search",
      "you-search",
    ]);
  });

  it("throws when no providers are configured", () => {
    expect(() =>
      withEnv(
        { TAVILY_API_KEY: undefined, EXA_API_KEY: undefined, YOU_API_KEY: undefined, YOU_FREE_SEARCH: undefined },
        () => advanceCursor(dir),
      ),
    ).toThrow("no search providers configured");
  });

  it("creates stateDir if it does not exist", () => {
    const nested = join(dir, "deep", "state");
    withEnv(
      { TAVILY_API_KEY: "tvly-abc", EXA_API_KEY: undefined, YOU_API_KEY: undefined, YOU_FREE_SEARCH: undefined },
      () => advanceCursor(nested),
    );
    // No error = directory was created
    expect(true).toBe(true);
  });
});
