import { describe, it, expect } from "bun:test";
import { ResearchProjectAdapter } from "./project-adapter";
import { buildSystemPrompt } from "./system-prompt";
import { buildPrompt } from "./build-prompt";
import type { WorkContext } from "./types";

const FAKE_REPO_ROOT = "/tmp/fake-repo";

const SAMPLE_CTX: WorkContext = {
  workMd: "# Sample work\n\nDo some research.",
  criteriaMd: "1. Find sources.\n2. Cite them.",
  todoMd: "- [ ] Search for info\n- [ ] Write findings",
};

describe("ResearchProjectAdapter", () => {
  const adapter = new ResearchProjectAdapter();

  describe("buildSystemPrompt()", () => {
    it("returns a non-empty string", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT);
      expect(result.length).toBeGreaterThan(0);
    });

    it("differs from the generic default system prompt", () => {
      const research = adapter.buildSystemPrompt(FAKE_REPO_ROOT);
      const generic = buildSystemPrompt(FAKE_REPO_ROOT);
      expect(research).not.toEqual(generic);
    });

    it("contains research-specific instructions", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT);
      expect(result).toContain("research mode");
      expect(result).toContain("Citation requirements");
      expect(result).toContain("Sources");
    });

    it("includes the preferred search provider hint when provided", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT, "tavily-search");
      expect(result).toContain("tavily-search");
    });
  });

  describe("buildPrompt()", () => {
    it("returns a non-empty string", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result.length).toBeGreaterThan(0);
    });

    it("differs from the generic default prompt", () => {
      const research = adapter.buildPrompt(SAMPLE_CTX);
      const generic = buildPrompt(SAMPLE_CTX);
      expect(research).not.toEqual(generic);
    });

    it("contains a research-specific preamble", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain("Research task");
    });

    it("includes all base sections (work.md, criteria.md, todo.md)", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain("work.md");
      expect(result).toContain("criteria.md");
      expect(result).toContain("todo.md");
    });

    it("preserves work.md content", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain(SAMPLE_CTX.workMd);
    });
  });
});
