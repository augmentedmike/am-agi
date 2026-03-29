import { describe, it, expect } from "bun:test";
import { CrmPipelineAdapter } from "./crm-pipeline-adapter";
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
  });
});
