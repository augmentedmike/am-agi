import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CrmPipelineAdapter, CrmStorageLayer } from "./crm-pipeline-adapter";
import { BunFileSystem } from "./filesystem";
import { buildPrompt } from "./build-prompt";
import type { WorkContext } from "./types";

const FAKE_REPO_ROOT = "/tmp/fake-repo";

const SAMPLE_CTX: WorkContext = {
  workMd: "# CRM enrichment\n\nEnrich contact records with missing email domains.",
  criteriaMd: "1. Email fields are populated.\n2. No hallucinated data.",
  todoMd: "- [ ] Read crm-data.json\n- [ ] Write crm-output.json",
};

describe("CrmPipelineAdapter", () => {
  const adapter = new CrmPipelineAdapter();

  describe("buildSystemPrompt()", () => {
    it("returns a non-empty string containing the word CRM", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("CRM");
    });

    it("instructs the agent to preserve original field values and not hallucinate data", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT);
      expect(result).toContain("Preserve original field values");
      expect(result).toContain("Do not hallucinate data");
    });

    it("includes preferred search provider hint when provided", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT, "tavily-search");
      expect(result).toContain("tavily-search");
    });
  });

  describe("buildPrompt()", () => {
    it("includes the original ctx.workMd content unchanged", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain(SAMPLE_CTX.workMd);
    });

    it("prepends a CRM-mode preamble referencing crm-data.json and crm-output.json", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      const baseResult = buildPrompt(SAMPLE_CTX);
      // preamble comes before base
      expect(result.indexOf("crm-data.json")).toBeLessThan(result.indexOf(SAMPLE_CTX.workMd));
      expect(result).toContain("crm-data.json");
      expect(result).toContain("crm-output.json");
      // result is longer than base (preamble was prepended)
      expect(result.length).toBeGreaterThan(baseResult.length);
    });

    it("instructs the agent to append change entries to crm-changes.log", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain("crm-changes.log");
    });

    it("includes record count in preamble when domainCtx is provided", () => {
      const domainCtx = {
        records: [
          { id: "c1", type: "contact" as const, fields: {}, meta: {} },
          { id: "c2", type: "account" as const, fields: {}, meta: {} },
        ],
        outputPath: "/tmp/crm-output.json",
      };
      const result = adapter.buildPrompt(SAMPLE_CTX, domainCtx);
      expect(result).toContain("2 records loaded");
    });

    it("omits record count when domainCtx is not provided", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).not.toContain("records loaded");
    });
  });
});

describe("CrmStorageLayer", () => {
  let dir: string;
  const fs = new BunFileSystem();
  const layer = new CrmStorageLayer();

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "crm-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe("load()", () => {
    it("parses crm-data.json and returns records with outputPath", async () => {
      const records = [
        { id: "r1", type: "contact", fields: { name: "Alice" }, meta: {} },
        { id: "r2", type: "account", fields: { name: "Acme" }, meta: {} },
      ];
      await writeFile(join(dir, "crm-data.json"), JSON.stringify(records));

      const ctx = await layer.load(dir, fs);
      expect(ctx.records).toHaveLength(2);
      expect(ctx.records[0].id).toBe("r1");
      expect(ctx.records[1].id).toBe("r2");
      expect(ctx.outputPath).toContain("crm-output.json");
    });

    it("sets outputPath to <workDir>/crm-output.json", async () => {
      await writeFile(join(dir, "crm-data.json"), "[]");
      const ctx = await layer.load(dir, fs);
      expect(ctx.outputPath).toBe(join(dir, "crm-output.json"));
    });

    it("returns an empty records array when crm-data.json contains []", async () => {
      await writeFile(join(dir, "crm-data.json"), "[]");
      const ctx = await layer.load(dir, fs);
      expect(ctx.records).toHaveLength(0);
    });

    it("throws when crm-data.json is missing", async () => {
      await expect(layer.load(dir, fs)).rejects.toThrow();
    });
  });

  describe("persist()", () => {
    it("writes records to crm-output.json as pretty JSON", async () => {
      const data = {
        records: [{ id: "r1", type: "contact" as const, fields: {}, meta: {} }],
        outputPath: join(dir, "crm-output.json"),
      };
      await layer.persist(dir, data, fs);
      const written = await Bun.file(join(dir, "crm-output.json")).text();
      const parsed = JSON.parse(written);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe("r1");
    });

    it("appends a log entry to crm-changes.log", async () => {
      const data = {
        records: [{ id: "r42", type: "opportunity" as const, fields: {}, meta: {} }],
        outputPath: join(dir, "crm-output.json"),
      };
      await layer.persist(dir, data, fs);
      const log = await Bun.file(join(dir, "crm-changes.log")).text();
      expect(log).toContain("r42");
      expect(log).toContain("processed");
    });
  });
});
