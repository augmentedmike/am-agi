import { join } from "node:path";
import type { WorkContext } from "./types";
import type { ProjectAdapter } from "./project-adapter";
import type { StorageLayer } from "./storage";
import type { FileSystem } from "./filesystem";
import { buildSystemPrompt } from "./system-prompt";
import { buildPrompt } from "./build-prompt";

/**
 * A single email record loaded from email-sync.json.
 */
export interface EmailSyncRecord {
  id: string;
  providerId: string;
  subject: string | null;
  fromAddress: string;
  toAddresses: string[];
  snippet: string | null;
  receivedAt: string;
  labels: string[];
  metadata: Record<string, unknown>;
}

/**
 * Domain context for email sync tasks.
 * Loaded by EmailSyncStorageLayer from `email-sync.json` at the start of each iteration.
 */
export interface EmailSyncDomainContext {
  /** The email records to be processed this iteration. */
  records: EmailSyncRecord[];
  /** Absolute path where processed records should be written. */
  outputPath: string;
}

/**
 * StorageLayer implementation for the email sync adapter.
 *
 * - `load()` reads `email-sync.json` from the work directory and returns a
 *   typed `EmailSyncDomainContext`.
 * - `persist()` writes processed records to `email-sync-output.json` and appends
 *   a timestamped audit entry to `email-sync-changes.log`.
 */
export class EmailSyncStorageLayer implements StorageLayer<EmailSyncDomainContext> {
  /**
   * Load email records from `<workDir>/email-sync.json`.
   *
   * @param workDir  Absolute path to the git worktree for this task.
   * @param fs       FileSystem implementation to use for all I/O.
   */
  async load(workDir: string, fs: FileSystem): Promise<EmailSyncDomainContext> {
    const dataPath = join(workDir, "email-sync.json");
    const raw = await fs.readFile(dataPath);
    const records = JSON.parse(raw) as EmailSyncRecord[];
    return {
      records,
      outputPath: join(workDir, "email-sync-output.json"),
    };
  }

  /**
   * Persist the processed email records.
   *
   * Writes the full records array to `email-sync-output.json` and appends one
   * audit entry per record to `email-sync-changes.log`.
   *
   * @param workDir  Absolute path to the git worktree for this task.
   * @param data     The (potentially mutated) domain context.
   * @param fs       FileSystem implementation to use for all I/O.
   */
  async persist(workDir: string, data: EmailSyncDomainContext, fs: FileSystem): Promise<void> {
    await fs.writeFile(data.outputPath, JSON.stringify(data.records, null, 2));

    const logPath = join(workDir, "email-sync-changes.log");
    const timestamp = new Date().toISOString();
    const lines = data.records
      .map(r => `${timestamp} ${r.id} processed`)
      .join("\n");
    await fs.appendFile(logPath, lines + "\n");
  }
}

/**
 * EmailSyncAdapter specialises the agent loop for email sync tasks.
 *
 * - System prompt: instructs the agent to operate on email records faithfully,
 *   preserve original field values, and maintain data integrity.
 * - User prompt: prepends an email-sync preamble that references the standard
 *   input/output files and the change log.
 * - Storage layer: loads `email-sync.json` and makes records available to the
 *   prompt builder as a typed `EmailSyncDomainContext`.
 */
export class EmailSyncAdapter implements ProjectAdapter {
  /** Storage layer that loads email-sync.json and persists email-sync-output.json. */
  readonly storageLayer: EmailSyncStorageLayer = new EmailSyncStorageLayer();

  buildSystemPrompt(repoRoot: string, preferredSearchProvider?: string): string {
    const base = buildSystemPrompt(repoRoot, preferredSearchProvider);

    const emailInstructions = `
## Email sync mode

You are operating in **email sync mode**. Your primary goal is to process, deduplicate, and persist email records according to the instructions in the work context.

### Data integrity rules
- **Preserve original field values.** Never overwrite an existing field with a different value unless the task explicitly asks you to do so.
- **Do not hallucinate data.** If a value is unknown or cannot be derived from the source data, leave the field empty or use \`null\` — do not invent plausible-sounding values.
- **Deduplicate by provider_id.** Each email has a unique \`provider_id\` — never create duplicate records for the same provider email.
- **One record, one change.** Apply the minimum change necessary to satisfy each instruction. Do not make unrequested modifications.

### Field validation
- All \`id\` and \`providerId\` fields must be non-empty strings.
- \`fromAddress\` must be a non-empty string.
- \`toAddresses\` must be an array (may be empty).
- \`receivedAt\` must be a valid ISO 8601 timestamp string.

### Output hygiene
- Write processed records to \`email-sync-output.json\` as a valid JSON array.
- Append one entry per processed record to \`email-sync-changes.log\` in the format: \`<timestamp> <id> <change-summary>\`.
- Do not leave partial writes — either a record is fully processed or it is skipped with a log entry explaining why.
`;

    return base + emailInstructions;
  }

  /**
   * Build the user-facing prompt for an email sync iteration.
   *
   * @param ctx        Work context loaded from the worktree.
   * @param domainCtx  Optional EmailSyncDomainContext injected by runIteration().
   *                   When present, record count is included in the preamble.
   */
  buildPrompt(ctx: WorkContext, domainCtx?: unknown): string {
    const base = buildPrompt(ctx);
    const sync = domainCtx as EmailSyncDomainContext | undefined;
    const recordCount = sync ? ` (${sync.records.length} records loaded)` : "";

    const preamble = `## Email sync task

You are performing an email sync iteration${recordCount}. Read records from \`email-sync.json\`, apply the processing described in the work context, and write results to \`email-sync-output.json\`. Append a summary of every change to \`email-sync-changes.log\`.

**Files:**
- Input:  \`email-sync.json\`        — array of email records to process
- Output: \`email-sync-output.json\`  — processed records (full array, not a diff)
- Log:    \`email-sync-changes.log\`  — append one line per processed record

---

`;

    return preamble + base;
  }
}
