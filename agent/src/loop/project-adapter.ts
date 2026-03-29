import type { WorkContext } from "./types";
import { buildSystemPrompt } from "./system-prompt";
import { buildPrompt } from "./build-prompt";

export { CrmPipelineAdapter } from "./crm-pipeline-adapter";
export type { CrmRecord } from "./crm-pipeline-adapter";

/**
 * ProjectAdapter allows callers to override the system prompt and user prompt
 * construction used by runIteration(). Implement this interface to create
 * domain-specific agent behaviors (e.g. research, code review, etc.).
 */
export interface ProjectAdapter {
  /**
   * Build the system prompt for this project type.
   *
   * @param repoRoot               Absolute path to the repo (worktree) root.
   * @param preferredSearchProvider  Optional search provider hint.
   */
  buildSystemPrompt(repoRoot: string, preferredSearchProvider?: string): string;

  /**
   * Build the user-facing prompt for a single iteration.
   *
   * @param ctx  Work context loaded from the worktree.
   */
  buildPrompt(ctx: WorkContext): string;
}

/**
 * ResearchProjectAdapter specialises the agent loop for research tasks.
 *
 * - System prompt: adds web-search guidance, citation requirements, and a
 *   structured research-output format on top of the generic AM instructions.
 * - User prompt: prepends a research preamble to the standard context sections.
 */
export class ResearchProjectAdapter implements ProjectAdapter {
  buildSystemPrompt(repoRoot: string, preferredSearchProvider?: string): string {
    const base = buildSystemPrompt(repoRoot, preferredSearchProvider);

    const researchInstructions = `
## Research mode

You are operating in **research mode**. Your primary goal is to gather, synthesise, and document information — not to write production code.

### Web search guidance
- Always search before answering factual questions you are uncertain about.
- Prefer authoritative primary sources (official docs, papers, RFCs) over secondary sources.
- Run at least two independent searches to cross-check important claims.
- If search results conflict, note the discrepancy explicitly.

### Citation requirements
- Every factual claim that came from a web search MUST include an inline citation: [Source Title](url).
- List all sources used at the bottom of your output under a **## Sources** heading.
- Do not fabricate URLs. If you cannot find a reliable source, state that explicitly.

### Research output format
Structure your output as follows:

\`\`\`
## Summary
<1–3 sentence executive summary>

## Findings
<numbered list of key findings, each with inline citations>

## Analysis
<synthesis and interpretation>

## Open questions
<anything you could not resolve or that needs follow-up>

## Sources
<bulleted list of all cited URLs>
\`\`\`

Stay factual. Do not speculate beyond what sources support.
`;

    return base + researchInstructions;
  }

  buildPrompt(ctx: WorkContext): string {
    const base = buildPrompt(ctx);

    const preamble = `## Research task

You are performing a research iteration. Use web search tools to gather information, synthesise findings, and document your results following the research output format defined in your system prompt.

For each claim you make:
1. Search for supporting evidence.
2. Cite the source inline.
3. Note any conflicting information.

---

`;

    return preamble + base;
  }
}
