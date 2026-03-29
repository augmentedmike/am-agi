import { join } from "node:path";
import type { WorkContext } from "./types";
import type { ProjectAdapter } from "./project-adapter";
import type { StorageLayer } from "./storage";
import type { FileSystem } from "./filesystem";
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
 * Domain context for CRM pipeline tasks.
 * Loaded by CrmStorageLayer from `crm-data.json` at the start of each iteration.
 */
export interface CrmDomainContext {
  /** The CRM records to be processed this iteration. */
  records: CrmRecord[];
  /** Absolute path where transformed records should be written. */
  outputPath: string;
}

/**
 * StorageLayer implementation for the CRM pipeline adapter.
 *
 * - `load()` reads `crm-data.json` from the work directory and returns a
 *   typed `CrmDomainContext`.
 * - `persist()` writes transformed records to `crm-output.json` and appends
 *   a timestamped summary to `crm-changes.log`.
 */
export class CrmStorageLayer implements StorageLayer<CrmDomainContext> {
  /**
   * Load CRM records from `<workDir>/crm-data.json`.
   *
   * @param workDir  Absolute path to the git worktree for this task.
   * @param fs       FileSystem implementation to use for all I/O.
   */
  async load(workDir: string, fs: FileSystem): Promise<CrmDomainContext> {
    const dataPath = join(workDir, "crm-data.json");
    const raw = await fs.readFile(dataPath);
    const records = JSON.parse(raw) as CrmRecord[];
    return {
      records,
      outputPath: join(workDir, "crm-output.json"),
    };
  }

  /**
   * Persist the processed CRM records.
   *
   * Writes the full records array to `crm-output.json` and appends one log
   * entry per record to `crm-changes.log`.
   *
   * @param workDir  Absolute path to the git worktree for this task.
   * @param data     The (potentially mutated) domain context.
   * @param fs       FileSystem implementation to use for all I/O.
   */
  async persist(workDir: string, data: CrmDomainContext, fs: FileSystem): Promise<void> {
    await fs.writeFile(data.outputPath, JSON.stringify(data.records, null, 2));

    const logPath = join(workDir, "crm-changes.log");
    const timestamp = new Date().toISOString();
    const lines = data.records
      .map(r => `${timestamp} ${r.id} processed`)
      .join("\n");
    await fs.appendFile(logPath, lines + "\n");
  }
}

/**
 * CrmPipelineAdapter specialises the agent loop for CRM data pipeline tasks.
 *
 * - System prompt: instructs the agent to operate on CRM records faithfully,
 *   preserve original field values, and never hallucinate data.
 * - User prompt: prepends a CRM-mode preamble that references the standard
 *   input/output files and the change log.
 * - Storage layer: loads `crm-data.json` and makes records available to the
 *   prompt builder as a typed `CrmDomainContext`.
 */
export class CrmPipelineAdapter implements ProjectAdapter {
  /** Storage layer that loads crm-data.json and persists crm-output.json. */
  readonly storageLayer: CrmStorageLayer = new CrmStorageLayer();

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

  /**
   * Build the user-facing prompt for a CRM pipeline iteration.
   *
   * @param ctx        Work context loaded from the worktree.
   * @param domainCtx  Optional CrmDomainContext injected by runIteration().
   *                   When present, record count is included in the preamble.
   */
  buildPrompt(ctx: WorkContext, domainCtx?: unknown): string {
    const base = buildPrompt(ctx);
    const crm = domainCtx as CrmDomainContext | undefined;
    const recordCount = crm ? ` (${crm.records.length} records loaded)` : "";

    const preamble = `## CRM pipeline task

You are performing a CRM data pipeline iteration${recordCount}. Read records from \`crm-data.json\`, apply the transformations described in the work context, and write results to \`crm-output.json\`. Append a summary of every change to \`crm-changes.log\`.

**Files:**
- Input:  \`crm-data.json\`  — array of CRM records to process
- Output: \`crm-output.json\` — transformed records (full array, not a diff)
- Log:    \`crm-changes.log\` — append one line per processed record

---

`;

    return preamble + base;
  }
}
