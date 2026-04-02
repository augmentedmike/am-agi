import type { ClaudeResult, ClaudeUsage } from "./types";

// Serialize claude process startup to prevent concurrent OAuth token refresh
// races. All invocations share this lock. Each caller holds it for
// STARTUP_HOLD_MS after spawning, giving the process time to auth before the
// next one starts. Processes then run fully concurrently after that.
let startupLock: Promise<void> = Promise.resolve();
const STARTUP_HOLD_MS = 4_000;

/**
 * Thrown when the Claude CLI reports an authentication failure
 * (stderr contains "Not logged in").
 *
 * Callers that want to distinguish auth failures from other errors can
 * catch this specifically and prompt the user to run /login.
 */
export class AuthError extends Error {
  constructor(message = "Claude auth expired") {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Thrown when the Claude CLI reports a usage rate limit.
 * Carries the UTC time at which the limit resets so the dispatcher can
 * pause new work until then instead of hammering the API.
 */
export class RateLimitError extends Error {
  /** UTC Date when the rate limit resets. */
  readonly resetAt: Date;

  constructor(resetAt: Date, message?: string) {
    super(message ?? `Rate limit hit — resets at ${resetAt.toISOString()}`);
    this.name = "RateLimitError";
    this.resetAt = resetAt;
  }
}

/**
 * Parse a rate-limit reset time from a Claude CLI message such as
 * "You've hit your limit · resets 12pm (America/Mexico_City)".
 *
 * Returns a UTC Date for when the limit resets, or null if the pattern
 * is not found.
 */
export function parseRateLimitReset(text: string): Date | null {
  // Match "resets 12pm (America/Mexico_City)" or "resets 9am (America/New_York)" etc.
  const m = text.match(/resets\s+(\d{1,2})(am|pm)\s+\(([^)]+)\)/i);
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  const ampm = m[2].toLowerCase();
  const tz = m[3];

  // Convert to 24-hour
  if (ampm === "pm" && hour !== 12) hour += 12;
  else if (ampm === "am" && hour === 12) hour = 0;

  // Get today's date in the target timezone (en-CA gives YYYY-MM-DD)
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const dp: Record<string, string> = {};
  for (const part of dateParts) if (part.type !== "literal") dp[part.type] = part.value;

  const localStr = `${dp.year}-${dp.month}-${dp.day}T${String(hour).padStart(2, "0")}:00:00`;

  // Convert local timezone time to UTC.
  // Treat localStr as if it were UTC (guess), then measure what time that
  // moment actually shows in the target timezone, compute the offset, and adjust.
  const guess = new Date(localStr + "Z");
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(guess);
  const tp: Record<string, string> = {};
  for (const part of tzParts) if (part.type !== "literal") tp[part.type] = part.value;
  const localAtGuess = new Date(
    `${tp.year}-${tp.month}-${tp.day}T${tp.hour}:${tp.minute}:${tp.second}Z`,
  );
  // offsetMs = UTC - localTime (e.g. UTC-6 gives offsetMs = 6h in ms)
  const offsetMs = guess.getTime() - localAtGuess.getTime();
  let resetUtc = new Date(guess.getTime() + offsetMs);

  // If the reset time is already past, the limit has already cleared — retry in 30s.
  if (resetUtc <= now) {
    return new Date(Date.now() + 30_000);
  }

  return resetUtc;
}

export interface StreamEvent {
  type: string;
  subtype?: string;
  message?: { role?: string; content?: unknown[] };
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface InvokeOptions {
  /** Path to the claude executable. Defaults to "claude". */
  claudePath?: string;
  /** Optional system prompt passed via --system-prompt to the Claude CLI. */
  systemPrompt?: string;
  /** Optional model override (e.g. "claude-haiku-4-5-20251001"). Defaults to Claude's own default. */
  model?: string;
  /**
   * Called for each parsed stream-json event as they arrive.
   * When provided, uses `--output-format stream-json` instead of `json`.
   */
  onEvent?: (event: StreamEvent) => void;
  /**
   * Path to an MCP config JSON file. When set, `--mcp-config <path>` is
   * appended to the Claude CLI args so the subprocess can use MCP servers.
   */
  mcpConfigPath?: string;
  /** Base64-encoded images to include as vision content in the user message. */
  images?: { base64: string; mimeType: string }[];
}

/**
 * INVOKE CLAUDE step — run the Claude CLI with the given prompt, streaming
 * stdout/stderr through to the parent process.
 *
 * Uses `--dangerously-skip-permissions`. Output format is `json` by default,
 * or `stream-json` when `onEvent` is provided (events are parsed and forwarded).
 * Sets `cwd` to `workDir` so Claude operates inside the worktree.
 *
 * Throws `AuthError` if stderr contains "Not logged in".
 */
export async function invokeClaude(
  workDir: string,
  prompt: string,
  options: InvokeOptions = {},
): Promise<ClaudeResult> {
  const claudePath = options.claudePath ?? "claude";
  const streaming = !!options.onEvent;

  // Acquire startup lock — wait for any previous spawn to finish its auth
  // window before we start. Release after STARTUP_HOLD_MS so the next caller
  // can proceed while we continue running concurrently.
  let releaseLock!: () => void;
  const prevLock = startupLock;
  startupLock = new Promise<void>(resolve => { releaseLock = resolve; });
  await prevLock;

  // Strip Claude Code session markers so the subprocess is not treated as a
  // nested invocation (CLAUDECODE=1 causes auth to fail in sub-processes).
  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, ...spawnEnv } = process.env;

  // Bun.spawn doesn't use spawnEnv.PATH for executable lookup — resolve the
  // full path explicitly so launchd agents (which have a custom PATH) work.
  const resolvedClaude = Bun.which(claudePath, { PATH: spawnEnv.PATH ?? process.env.PATH ?? "" })
    ?? claudePath;

  const outputFormat = streaming ? "stream-json" : "json";
  const hasImages = options.images && options.images.length > 0;

  let args: string[];
  let stdinContent: string | null = null;

  if (hasImages) {
    // Use --input-format stream-json to pass image content via stdin
    args = [resolvedClaude, "--dangerously-skip-permissions", "--input-format", "stream-json", "--output-format", outputFormat];
    if (streaming) args.push("--verbose");
    if (options.systemPrompt) args.splice(1, 0, "--system-prompt", options.systemPrompt);
    if (options.model) args.splice(1, 0, "--model", options.model);
    if (options.mcpConfigPath) args.push("--mcp-config", options.mcpConfigPath);

    const imageBlocks = options.images!.map(img => ({
      type: "image",
      source: { type: "base64", media_type: img.mimeType, data: img.base64 },
    }));
    stdinContent = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: prompt }, ...imageBlocks],
      },
    }) + "\n";
  } else {
    args = [resolvedClaude, "--dangerously-skip-permissions", "-p", prompt, "--output-format", outputFormat];
    if (streaming) args.push("--verbose");
    if (options.systemPrompt) args.splice(1, 0, "--system-prompt", options.systemPrompt);
    if (options.model) args.splice(1, 0, "--model", options.model);
    if (options.mcpConfigPath) args.push("--mcp-config", options.mcpConfigPath);
  }

  const proc = Bun.spawn(
    args,
    {
      cwd: workDir,
      stdout: "pipe",
      stderr: "pipe",
      stdin: stdinContent !== null ? "pipe" : "ignore",
      env: spawnEnv,
    },
  );

  if (stdinContent !== null && proc.stdin) {
    proc.stdin.write(stdinContent);
    proc.stdin.end();
  }

  // Hold the lock for STARTUP_HOLD_MS then release so the next spawn can start
  setTimeout(releaseLock, STARTUP_HOLD_MS);

  const decoder = new TextDecoder();

  // Read stdout and stderr concurrently to prevent pipe deadlock.
  // Use for-await-of (AsyncIterator protocol) rather than getReader() —
  // more reliable in Bun for fast-exiting subprocesses.
  let lineBuffer = "";
  const [stdoutChunks, stderrChunks] = await Promise.all([
    (async () => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of proc.stdout as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
        process.stdout.write(chunk);
        if (streaming && options.onEvent) {
          lineBuffer += decoder.decode(chunk, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try { options.onEvent(JSON.parse(line) as StreamEvent); } catch { /* skip malformed */ }
          }
        }
      }
      // Flush remaining buffer
      if (streaming && options.onEvent && lineBuffer.trim()) {
        try { options.onEvent(JSON.parse(lineBuffer) as StreamEvent); } catch {}
      }
      return chunks;
    })(),
    (async () => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of proc.stderr as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return chunks;
    })(),
  ]);

  const exitCode = await proc.exited;
  const rawOutput = stdoutChunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
  const stderrText = stderrChunks.map((c) => new TextDecoder().decode(c)).join("");

  // Re-emit stderr to parent process so the human can see it.
  if (stderrText) {
    process.stderr.write(stderrText);
  }

  // Detect rate limit — throw RateLimitError so the dispatcher can pause
  // until the reset time instead of hammering the API repeatedly.
  // Check both stdout and stderr since the CLI may surface the message in either.
  const combinedOutput = rawOutput + stderrText;
  if (combinedOutput.includes("You've hit your limit")) {
    const resetAt = parseRateLimitReset(combinedOutput) ?? new Date(Date.now() + 3_600_000);
    throw new RateLimitError(resetAt);
  }

  // Detect auth failure — throw so callers can handle it without retrying.
  // Criterion 1: explicit "Not logged in" message
  if (stderrText.includes("Not logged in")) {
    throw new AuthError("Claude auth expired — run /login to restore");
  }
  // Criterion 2: mid-stream auth failures — non-zero exit with auth-related stderr
  // (no "Not logged in" but other auth signals like token expiry, OAuth errors, etc.)
  if (exitCode !== 0) {
    const authPatterns = [
      "authentication",
      "unauthorized",
      "401",
      "token expired",
      "oauth",
      "invalid api key",
      "api key",
      "credentials",
    ];
    const lowerStderr = stderrText.toLowerCase();
    if (authPatterns.some((p) => lowerStderr.includes(p))) {
      throw new AuthError("Claude auth expired — run /login to restore");
    }
  }

  let result = rawOutput;
  let usage: ClaudeUsage | undefined;

  if (streaming) {
    // Extract result text and usage from the stream-json `result` event
    for (const line of rawOutput.split("\n")) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as StreamEvent;
        if (ev.type === "result" && ev.result !== undefined) {
          result = ev.result;
        }
        if (ev.usage) {
          usage = {
            input_tokens: ev.usage.input_tokens ?? 0,
            output_tokens: ev.usage.output_tokens ?? 0,
            cache_read_input_tokens: ev.usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: ev.usage.cache_creation_input_tokens ?? 0,
          };
        }
      } catch {}
    }
  } else {
    // Parse usage from the CLI JSON envelope (--output-format json)
    try {
      const envelope = JSON.parse(result);
      if (envelope?.usage) {
        usage = {
          input_tokens: envelope.usage.input_tokens ?? 0,
          output_tokens: envelope.usage.output_tokens ?? 0,
          cache_read_input_tokens: envelope.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: envelope.usage.cache_creation_input_tokens ?? 0,
        };
      }
    } catch { /* non-JSON output or missing usage — ok */ }
  }

  return { exitCode, result, usage };
}
