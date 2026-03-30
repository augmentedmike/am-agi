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
export interface EmailRecord {
  id: string;
  providerId: string;
  syncAccountEmail: string;
  threadId?: string | null;
  subject?: string | null;
  fromAddress: string;
  toAddresses?: string[];
  ccAddresses?: string[];
  snippet?: string | null;
  bodyText?: string | null;
  labels?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  receivedAt: string;
  metadata?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    providerAttachmentId?: string | null;
  }>;
}

/**
 * Domain context for email sync tasks.
 * Loaded by EmailSyncStorageLayer from `email-sync.json` at the start of each iteration.
 */
export interface EmailSyncDomainContext {
  /** The email records to be processed this iteration. */
  emails: EmailRecord[];
  /** Absolute path where processed emails should be written. */
  outputPath: string;
  /** Absolute path for the change log. */
  logPath: string;
}

/**
 * StorageLayer implementation for the email sync adapter.
 *
 * - `load()` reads `email-sync.json` from the work directory and returns a
 *   typed `EmailSyncDomainContext`.
 * - `persist()` writes processed emails to `email-sync-output.json` and appends
 *   a timestamped summary to `email-sync-changes.log`.
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
    const emails = JSON.parse(raw) as EmailRecord[];
    return {
      emails,
      outputPath: join(workDir, "email-sync-output.json"),
      logPath: join(workDir, "email-sync-changes.log"),
    };
  }

  /**
   * Persist the processed email records.
   *
   * Writes the full emails array to `email-sync-output.json` and appends one
   * log entry per email to `email-sync-changes.log`.
   *
   * @param workDir  Absolute path to the git worktree for this task.
   * @param data     The (potentially mutated) domain context.
   * @param fs       FileSystem implementation to use for all I/O.
   */
  async persist(workDir: string, data: EmailSyncDomainContext, fs: FileSystem): Promise<void> {
    await fs.writeFile(data.outputPath, JSON.stringify(data.emails, null, 2));

    const timestamp = new Date().toISOString();
    const lines = data.emails
      .map(e => `${timestamp} ${e.id} processed`)
      .join("\n");
    await fs.appendFile(data.logPath, lines + "\n");
  }
}

/**
 * EmailSyncAdapter specialises the agent loop for email synchronisation tasks.
 *
 * - System prompt: instructs the agent to operate on email records faithfully,
 *   preserve original field values, and never hallucinate data.
 * - User prompt: prepends an email-mode preamble that references the standard
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

You are operating in **email sync mode**. Your primary goal is to process, classify, and persist email records according to the instructions in the work context.

### Data integrity rules
- **Preserve original field values.** Never overwrite an existing field with a different value unless the task explicitly asks you to do so.
- **Do not hallucinate data.** If a value is unknown or cannot be derived from the source data, leave the field empty or use \`null\` — do not invent plausible-sounding values.
- **One record, one change.** Apply the minimum change necessary to satisfy each instruction. Do not make unrequested modifications.

### Field validation
- All \`id\` fields must be non-empty strings.
- \`fromAddress\` must be a non-empty string.
- \`receivedAt\` must be a valid ISO 8601 timestamp.
- \`toAddresses\`, \`ccAddresses\`, \`labels\` must be arrays (never null).
- \`attachments\` must be an array of objects with \`filename\`, \`mimeType\`, and \`sizeBytes\`.

### Output hygiene
- Write processed email records to \`email-sync-output.json\` as a valid JSON array.
- Append one entry per processed email to \`email-sync-changes.log\` in the format: \`<timestamp> <id> <change-summary>\`.
- Do not leave partial writes — either a record is fully processed or it is skipped with a log entry explaining why.
`;

    return base + emailInstructions;
  }

  /**
   * Build the user-facing prompt for an email sync iteration.
   *
   * @param ctx        Work context loaded from the worktree.
   * @param domainCtx  Optional EmailSyncDomainContext injected by runIteration().
   *                   When present, email count is included in the preamble.
   */
  buildPrompt(ctx: WorkContext, domainCtx?: unknown): string {
    const base = buildPrompt(ctx);
    const sync = domainCtx as EmailSyncDomainContext | undefined;
    const emailCount = sync ? ` (${sync.emails.length} emails loaded)` : "";

    const preamble = `## Email sync task

You are performing an email synchronisation iteration${emailCount}. Read email records from \`email-sync.json\`, apply the transformations described in the work context, and write results to \`email-sync-output.json\`. Append a summary of every change to \`email-sync-changes.log\`.

**Files:**
- Input:  \`email-sync.json\`         — array of email records to process
- Output: \`email-sync-output.json\`  — transformed records (full array, not a diff)
- Log:    \`email-sync-changes.log\`  — append one line per processed email

---

`;

    return preamble + base;
  }
}
