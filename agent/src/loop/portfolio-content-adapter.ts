import { join } from "node:path";
import { readdir } from "node:fs/promises";
import type { WorkContext } from "./types";
import type { ProjectAdapter } from "./project-adapter";
import type { StorageLayer } from "./storage";
import type { FileSystem } from "./filesystem";
import { buildSystemPrompt } from "./system-prompt";
import { buildPrompt } from "./build-prompt";

/**
 * An entry representing a single blog/portfolio post found in the `docs/` directory.
 */
export interface PostEntry {
  /** The directory name, e.g. `042-my-post`. */
  name: string;
  /** The numeric sequence number extracted from the directory name. */
  sequence: number;
}

/**
 * Domain context for portfolio/content tasks.
 * Loaded by PortfolioStorageLayer by scanning the `docs/` directory.
 */
export interface PortfolioDomainContext {
  /** All posts discovered in `docs/`, sorted by sequence number. */
  posts: PostEntry[];
  /** The next sequence number to use for a new post (max existing + 1, or 1 if none). */
  nextSequence: number;
}

/**
 * StorageLayer implementation for the portfolio content adapter.
 *
 * - `load()` scans `<workDir>/docs/` to enumerate existing posts and computes
 *   the next sequence number. This is read-only — the agent writes post files
 *   directly; the storage layer only provides context.
 * - `persist()` is a no-op: the agent writes files directly to `docs/`.
 */
export class PortfolioStorageLayer implements StorageLayer<PortfolioDomainContext> {
  /**
   * Scan `<workDir>/docs/` for existing posts and compute the next sequence number.
   *
   * @param workDir  Absolute path to the git worktree for this task.
   * @param _fs      FileSystem (unused — directory scanning uses Node fs directly).
   */
  async load(workDir: string, _fs: FileSystem): Promise<PortfolioDomainContext> {
    const docsDir = join(workDir, "docs");
    let entries: string[] = [];
    try {
      entries = await readdir(docsDir);
    } catch {
      // docs/ may not exist yet — treat as empty
    }

    // Match directories that start with a numeric prefix: NNN-slug
    const seqPattern = /^(\d+)-/;
    const posts: PostEntry[] = entries
      .map(name => {
        const match = seqPattern.exec(name);
        return match ? { name, sequence: parseInt(match[1], 10) } : null;
      })
      .filter((e): e is PostEntry => e !== null)
      .sort((a, b) => a.sequence - b.sequence);

    const maxSeq = posts.length > 0 ? Math.max(...posts.map(p => p.sequence)) : 0;
    const nextSequence = maxSeq + 1;

    return { posts, nextSequence };
  }

  /**
   * No-op: the portfolio agent writes post files directly to `docs/`.
   * This method exists to satisfy the StorageLayer contract.
   */
  async persist(_workDir: string, _data: PortfolioDomainContext, _fs: FileSystem): Promise<void> {
    // intentional no-op
  }
}

/**
 * PortfolioContentAdapter specialises the agent loop for portfolio/content tasks.
 *
 * - System prompt: adds metadata requirements, asset format rules, naming
 *   conventions, and output file hygiene on top of the generic AM instructions.
 * - User prompt: prepends a portfolio/content preamble to the standard context
 *   sections and injects the computed next sequence number when available.
 * - Storage layer: scans `docs/` to enumerate existing posts and computes the
 *   next sequence number, making it available to `buildPrompt()`.
 */
export class PortfolioContentAdapter implements ProjectAdapter {
  /** Storage layer that scans docs/ and computes the next post sequence number. */
  readonly storageLayer: PortfolioStorageLayer = new PortfolioStorageLayer();

  buildSystemPrompt(repoRoot: string, preferredSearchProvider?: string): string {
    const base = buildSystemPrompt(repoRoot, preferredSearchProvider);

    const portfolioInstructions = `
## Portfolio / content mode

You are operating in **portfolio/content mode**. Your primary goal is to create, edit, or manage blog posts, portfolio entries, and associated assets.

### Metadata requirements
Every content post MUST include front-matter with these fields:
- \`title\`: Human-readable post title (sentence case, no trailing punctuation)
- \`description\`: 1–2 sentence summary suitable for meta tags and previews
- \`slug\`: URL-safe identifier derived from the title (kebab-case, lowercase, no special chars)
- \`date\`: ISO 8601 date string (YYYY-MM-DD)
- \`tags\`: Array of lowercase kebab-case tag strings

### Asset format rules
- All images MUST be \`.jpg\` or \`.webp\` — never \`.png\` or \`.bmp\`
- Optimise images before committing (target ≤ 200 KB for standard hero images)
- SVGs are allowed for icons and diagrams; keep them clean (no editor bloat)

### Naming conventions
- Post directories and asset folders follow the pattern \`NNN-slug\` where \`NNN\` is a zero-padded three-digit sequence number (e.g. \`042-my-post\`)
- Sequence numbers are computed from the existing post order — never hardcode or guess
- File names within a post directory use the same \`NNN-slug\` prefix

### Output file hygiene
- Build artefacts go in \`./tmp/\` (gitignored) — never commit them
- Do not commit raw unoptimised assets or duplicate directories
- Keep \`docs/\` clean: no generated files, no build output
- Delete any temp files created during the task before committing
`;

    return base + portfolioInstructions;
  }

  /**
   * Build the user-facing prompt for a portfolio/content iteration.
   *
   * @param ctx        Work context loaded from the worktree.
   * @param domainCtx  Optional PortfolioDomainContext injected by runIteration().
   *                   When present, the next sequence number is injected into
   *                   the preamble so the agent never has to guess.
   */
  buildPrompt(ctx: WorkContext, domainCtx?: unknown): string {
    const base = buildPrompt(ctx);
    const portfolio = domainCtx as PortfolioDomainContext | undefined;
    const seqHint = portfolio
      ? `\n**Next sequence number:** \`${String(portfolio.nextSequence).padStart(3, "0")}\` (${portfolio.posts.length} existing posts found in docs/)\n`
      : "";

    const preamble = `## Portfolio / content task
${seqHint}
You are performing a portfolio or content iteration. Follow the metadata requirements, asset format rules, naming conventions, and output file hygiene defined in your system prompt.

Before writing any content:
1. Check existing post sequence numbers to compute the next \`NNN\` prefix — never hardcode.
2. Ensure all images are \`.jpg\` or \`.webp\` (convert if necessary).
3. Validate that front-matter includes \`title\`, \`description\`, \`slug\`, \`date\`, and \`tags\`.

---

`;

    return preamble + base;
  }
}
