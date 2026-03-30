import type { WorkContext } from "./types";
import type { StorageLayer } from "./storage";
import { buildSystemPrompt } from "./system-prompt";
import { buildPrompt } from "./build-prompt";

export { CrmPipelineAdapter } from "./crm-pipeline-adapter";
export type { CrmRecord, CrmDomainContext } from "./crm-pipeline-adapter";

/**
 * DataBackedAdapter is implemented by adapters that manage a persistent
 * data store (e.g. SQLite). Callers can use isDataBackedAdapter() to detect
 * this capability and invoke init/close lifecycle hooks.
 */
export interface DataBackedAdapter {
  /** Unique identifier for this adapter instance. */
  readonly adapterId: string;
  /** Called once before any iteration work — opens connections, creates tables, etc. */
  init(workDir: string): Promise<void>;
  /** Called after iteration work completes — closes connections, flushes buffers, etc. */
  close(): void;
}

/**
 * Type guard — returns true when obj implements DataBackedAdapter.
 */
export function isDataBackedAdapter(obj: unknown): obj is DataBackedAdapter {
  if (obj === null || typeof obj !== "object") return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a["adapterId"] === "string" &&
    typeof a["init"] === "function" &&
    typeof a["close"] === "function"
  );
}

/**
 * ProjectAdapter allows callers to override the system prompt and user prompt
 * construction used by runIteration(). Implement this interface to create
 * domain-specific agent behaviors (e.g. research, code review, etc.).
 */
export interface ProjectAdapter {
  /**
   * Optional lifecycle hook — called once before buildPrompt().
   * Use for async setup (e.g. opening a DB connection, fetching remote data).
   */
  init?(workDir: string): Promise<void>;

  /**
   * Optional lifecycle hook — called after invoke(), even if invoke() throws.
   * Use for cleanup (e.g. closing connections, flushing buffers).
   */
  close?(): void;

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
   * @param ctx        Work context loaded from the worktree.
   * @param domainCtx  Optional domain context loaded by the adapter's storageLayer.
   *                   Typed as `unknown` at the call site for backward compatibility;
   *                   each concrete adapter should narrow to its own domain type.
   */
  buildPrompt(ctx: WorkContext, domainCtx?: unknown): string;

  /**
   * Optional storage layer that the adapter uses to load and persist
   * domain-specific data (e.g. CRM records, portfolio post list).
   * When present, `runIteration()` will call `storageLayer.load()` before
   * building the prompt and pass the result as `domainCtx`.
   */
  storageLayer?: StorageLayer<unknown>;
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

  buildPrompt(ctx: WorkContext, _domainCtx?: unknown): string {
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
