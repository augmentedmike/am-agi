import { describe, it, expect } from "bun:test";
import { PortfolioContentAdapter } from "./portfolio-content-adapter";
import { buildSystemPrompt } from "./system-prompt";
import { buildPrompt } from "./build-prompt";
import type { WorkContext } from "./types";

const FAKE_REPO_ROOT = "/tmp/fake-repo";

const SAMPLE_CTX: WorkContext = {
  workMd: "# Sample work\n\nCreate a portfolio post.",
  criteriaMd: "1. Post has front-matter.\n2. Images are jpg/webp.",
  todoMd: "- [ ] Write post\n- [ ] Add images",
};

describe("PortfolioContentAdapter", () => {
  const adapter = new PortfolioContentAdapter();

  describe("buildSystemPrompt()", () => {
    it("returns a non-empty string", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT);
      expect(result.length).toBeGreaterThan(0);
    });

    it("differs from the generic default system prompt", () => {
      const portfolio = adapter.buildSystemPrompt(FAKE_REPO_ROOT);
      const generic = buildSystemPrompt(FAKE_REPO_ROOT);
      expect(portfolio).not.toEqual(generic);
    });

    it("contains portfolio-specific keywords", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT);
      expect(result).toContain("portfolio");
      expect(result).toContain("Metadata");
      expect(result).toContain("slug");
      expect(result).toContain("jpg");
      expect(result).toContain("webp");
      expect(result).toContain("NNN-slug");
    });

    it("includes preferred search provider hint when provided", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT, "tavily-search");
      expect(result).toContain("tavily-search");
    });

    it("includes preferred search provider hint for alternate provider", () => {
      const result = adapter.buildSystemPrompt(FAKE_REPO_ROOT, "exa-search");
      expect(result).toContain("exa-search");
    });
  });

  describe("buildPrompt()", () => {
    it("returns a non-empty string", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result.length).toBeGreaterThan(0);
    });

    it("differs from the generic default prompt", () => {
      const portfolio = adapter.buildPrompt(SAMPLE_CTX);
      const generic = buildPrompt(SAMPLE_CTX);
      expect(portfolio).not.toEqual(generic);
    });

    it("contains a portfolio-specific preamble", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain("Portfolio / content task");
    });

    it("preserves all base sections (work.md, criteria.md, todo.md)", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain("work.md");
      expect(result).toContain("criteria.md");
      expect(result).toContain("todo.md");
    });

    it("preserves work.md content", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain(SAMPLE_CTX.workMd);
    });

    it("preserves criteria.md content", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain(SAMPLE_CTX.criteriaMd!);
    });

    it("preserves todo.md content", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).toContain(SAMPLE_CTX.todoMd!);
    });
  });
});
