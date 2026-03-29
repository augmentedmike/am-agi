import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PortfolioContentAdapter, PortfolioStorageLayer } from "./portfolio-content-adapter";
import { BunFileSystem } from "./filesystem";
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

    it("injects next sequence number when domainCtx is provided", () => {
      const domainCtx = {
        posts: [
          { name: "001-hello", sequence: 1 },
          { name: "002-world", sequence: 2 },
        ],
        nextSequence: 3,
      };
      const result = adapter.buildPrompt(SAMPLE_CTX, domainCtx);
      expect(result).toContain("003");
      expect(result).toContain("2 existing posts");
    });

    it("omits sequence hint when domainCtx is not provided", () => {
      const result = adapter.buildPrompt(SAMPLE_CTX);
      expect(result).not.toContain("Next sequence number");
    });
  });
});

describe("PortfolioStorageLayer", () => {
  let dir: string;
  const fs = new BunFileSystem();
  const layer = new PortfolioStorageLayer();

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "portfolio-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe("load()", () => {
    it("returns empty posts and nextSequence=1 when docs/ does not exist", async () => {
      const ctx = await layer.load(dir, fs);
      expect(ctx.posts).toHaveLength(0);
      expect(ctx.nextSequence).toBe(1);
    });

    it("returns empty posts and nextSequence=1 when docs/ is empty", async () => {
      await mkdir(join(dir, "docs"));
      const ctx = await layer.load(dir, fs);
      expect(ctx.posts).toHaveLength(0);
      expect(ctx.nextSequence).toBe(1);
    });

    it("enumerates NNN-slug directories and computes next sequence", async () => {
      const docsDir = join(dir, "docs");
      await mkdir(docsDir);
      await mkdir(join(docsDir, "001-first-post"));
      await mkdir(join(docsDir, "002-second-post"));
      await mkdir(join(docsDir, "005-fifth-post"));

      const ctx = await layer.load(dir, fs);
      expect(ctx.posts).toHaveLength(3);
      expect(ctx.nextSequence).toBe(6);
    });

    it("ignores entries that do not match the NNN-slug pattern", async () => {
      const docsDir = join(dir, "docs");
      await mkdir(docsDir);
      await mkdir(join(docsDir, "001-valid"));
      await mkdir(join(docsDir, "not-a-sequence"));
      await mkdir(join(docsDir, "README"));

      const ctx = await layer.load(dir, fs);
      expect(ctx.posts).toHaveLength(1);
      expect(ctx.posts[0].name).toBe("001-valid");
      expect(ctx.nextSequence).toBe(2);
    });

    it("sorts posts by sequence number", async () => {
      const docsDir = join(dir, "docs");
      await mkdir(docsDir);
      await mkdir(join(docsDir, "010-later"));
      await mkdir(join(docsDir, "003-earlier"));

      const ctx = await layer.load(dir, fs);
      expect(ctx.posts[0].sequence).toBe(3);
      expect(ctx.posts[1].sequence).toBe(10);
    });

    it("persist() is a no-op and resolves without error", async () => {
      const ctx = { posts: [], nextSequence: 1 };
      await expect(layer.persist(dir, ctx, fs)).resolves.toBeUndefined();
    });
  });
});
