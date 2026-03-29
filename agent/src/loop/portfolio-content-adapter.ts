import type { WorkContext } from "./types";
import type { ProjectAdapter } from "./project-adapter";
import { buildSystemPrompt } from "./system-prompt";
import { buildPrompt } from "./build-prompt";

/**
 * PortfolioContentAdapter specialises the agent loop for portfolio/content tasks.
 *
 * - System prompt: adds metadata requirements, asset format rules, naming
 *   conventions, and output file hygiene on top of the generic AM instructions.
 * - User prompt: prepends a portfolio/content preamble to the standard context sections.
 */
export class PortfolioContentAdapter implements ProjectAdapter {
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

  buildPrompt(ctx: WorkContext): string {
    const base = buildPrompt(ctx);

    const preamble = `## Portfolio / content task

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
