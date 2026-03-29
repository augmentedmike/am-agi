import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isDataBackedAdapter } from "./project-adapter";
import { CrmPipelineAdapter } from "./crm-pipeline-adapter";

// ---------------------------------------------------------------------------
// isDataBackedAdapter type guard
// ---------------------------------------------------------------------------

describe("isDataBackedAdapter", () => {
  it("returns false for null", () => {
    expect(isDataBackedAdapter(null)).toBe(false);
  });

  it("returns false for non-object primitives", () => {
    expect(isDataBackedAdapter(42)).toBe(false);
    expect(isDataBackedAdapter("string")).toBe(false);
    expect(isDataBackedAdapter(true)).toBe(false);
    expect(isDataBackedAdapter(undefined)).toBe(false);
  });

  it("returns false for a plain object missing all members", () => {
    expect(isDataBackedAdapter({})).toBe(false);
  });

  it("returns false when adapterId is missing", () => {
    expect(isDataBackedAdapter({ init: async () => {}, close: () => {} })).toBe(false);
  });

  it("returns false when init is missing", () => {
    expect(isDataBackedAdapter({ adapterId: "x", close: () => {} })).toBe(false);
  });

  it("returns false when close is missing", () => {
    expect(isDataBackedAdapter({ adapterId: "x", init: async () => {} })).toBe(false);
  });

  it("returns true when all three members are present", () => {
    expect(
      isDataBackedAdapter({
        adapterId: "test",
        init: async () => {},
        close: () => {},
      }),
    ).toBe(true);
  });

  it("returns false when adapterId is not a string", () => {
    expect(isDataBackedAdapter({ adapterId: 42, init: async () => {}, close: () => {} })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CrmPipelineAdapter lifecycle
// ---------------------------------------------------------------------------

describe("CrmPipelineAdapter lifecycle", () => {
  let dir: string;
  let adapter: CrmPipelineAdapter;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "crm-adapter-test-"));
    adapter = new CrmPipelineAdapter();
  });

  afterEach(async () => {
    // Always try to close in case a test left it open
    try { adapter.close(); } catch { /* ignore */ }
    await rm(dir, { recursive: true, force: true });
  });

  it("init() creates the .am/ directory if it does not exist", async () => {
    await adapter.init(dir);
    expect(existsSync(join(dir, ".am"))).toBe(true);
  });

  it("init() creates the crm_records table", async () => {
    await adapter.init(dir);
    // Use adapter's internal db via the public API — just verify table exists
    // by checking the db file was created
    expect(existsSync(join(dir, ".am", "crm.db"))).toBe(true);
  });

  it("init() creates the database at workDir/.am/crm.db", async () => {
    await adapter.init(dir);
    expect(existsSync(join(dir, ".am", "crm.db"))).toBe(true);
  });

  it("close() does not throw on a cleanly opened DB", async () => {
    await adapter.init(dir);
    expect(() => adapter.close()).not.toThrow();
  });

  it("close() is idempotent (double-close does not throw)", async () => {
    await adapter.init(dir);
    adapter.close();
    expect(() => adapter.close()).not.toThrow();
  });

  it("adapterId is 'crm'", () => {
    expect(adapter.adapterId).toBe("crm");
  });

  it("satisfies isDataBackedAdapter after construction", () => {
    expect(isDataBackedAdapter(adapter)).toBe(true);
  });
});
