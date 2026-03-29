import type { WorkContext } from "./types";
import type { ProjectAdapter } from "./project-adapter";
import { buildSystemPrompt } from "./system-prompt";
import { buildPrompt } from "./build-prompt";

/**
 * A CRM record loaded from crm-data.json.
 */
export interface CrmRecord {
  id: string;
  type: "contact" | "account" | "opportunity";
  fields: Record<string, unknown>;
  meta: Record<string, unknown>;
}

/**
 * CrmPipelineAdapter specialises the agent loop for CRM data pipeline tasks.
 *
 * - System prompt: instructs the agent to operate on CRM records faithfully,
 *   preserve original field values, and never hallucinate data.
 * - User prompt: prepends a CRM-mode preamble that references the standard
 *   input/output files and the change log.
 */
export class CrmPipelineAdapter implements ProjectAdapter {
  buildSystemPrompt(repoRoot: string, preferredSearchProvider?: string): string {
    const base = buildSystemPrompt(repoRoot, preferredSearchProvider);

    const crmInstructions = `
## CRM pipeline mode

You are operating in **CRM pipeline mode**. Your primary goal is to process, enrich, and transform CRM records according to the instructions in the work context.

### Data integrity rules
- **Preserve original field values.** Never overwrite an existing field with a different value unless the task explicitly asks you to do so.
- **Do not hallucinate data.** If a value is unknown or cannot be derived from the source data, leave the field empty or use \`null\` — do not invent plausible-sounding values.
- **One record, one change.** Apply the minimum change necessary to satisfy each instruction. Do not make unrequested modifications.

### Field validation
- All \`id\` fields must be non-empty strings.
- \`type\` must be one of: \`contact\`, \`account\`, \`opportunity\`.
- \`fields\` and \`meta\` must be plain objects (not arrays or primitives).

### Output hygiene
- Write transformed records to \`crm-output.json\` as a valid JSON array.
- Append one entry per processed record to \`crm-changes.log\` in the format: \`<timestamp> <id> <change-summary>\`.
- Do not leave partial writes — either a record is fully processed or it is skipped with a log entry explaining why.
`;

    return base + crmInstructions;
  }

  buildPrompt(ctx: WorkContext): string {
    const base = buildPrompt(ctx);

    const preamble = `## CRM pipeline task

You are performing a CRM data pipeline iteration. Read records from \`crm-data.json\`, apply the transformations described in the work context, and write results to \`crm-output.json\`. Append a summary of every change to \`crm-changes.log\`.

**Files:**
- Input:  \`crm-data.json\`  — array of CRM records to process
- Output: \`crm-output.json\` — transformed records (full array, not a diff)
- Log:    \`crm-changes.log\` — append one line per processed record

---

`;

    return preamble + base;
  }
}
