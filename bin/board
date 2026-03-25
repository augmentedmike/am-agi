#!/usr/bin/env bun
/**
 * board — CLI interface to the Kanban board API.
 *
 * Usage:
 *   board create --title <title> [--priority critical|high|normal|low] [--attach <path>...]
 *   board move <id> <state>
 *   board update <id> [--title <title>] [--priority <priority>] [--log <msg>] [--attach <path>...]
 *   board show <id>
 *   board search [--state <state>] [--priority <priority>] [--text <query>] [--all]
 *   board archive <id> [--reason <msg>]
 *
 * Exit codes: 0 = success, 1 = gate rejection / validation error, 2 = unexpected error
 */

const BOARD_URL = process.env.BOARD_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
}

async function apiClient<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const url = `${BOARD_URL}/api${path}`;
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`board: connection failed — ${msg}\n`);
    process.exit(2);
  }
  let parsed: T;
  try {
    parsed = (await res.json()) as T;
  } catch {
    parsed = null as T;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

// ---------------------------------------------------------------------------
// Arg parser
// ---------------------------------------------------------------------------

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | string[]>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | string[]> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) {
        flags[key] = "true";
      } else {
        const existing = flags[key];
        if (existing !== undefined) {
          flags[key] = Array.isArray(existing) ? [...existing, val] : [existing, val];
        } else {
          flags[key] = val;
        }
        i++;
      }
    } else {
      positional.push(arg);
    }
    i++;
  }
  return { positional, flags };
}

function flag(args: ParsedArgs, key: string): string | undefined {
  const v = args.flags[key];
  return Array.isArray(v) ? v[v.length - 1] : v;
}

function flagList(args: ParsedArgs, key: string): string[] {
  const v = args.flags[key];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function out(msg: string): void {
  process.stdout.write(msg + "\n");
}

function die(msg: string, code = 2): never {
  process.stderr.write("board: " + msg + "\n");
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdCreate(args: ParsedArgs): Promise<void> {
  const title = flag(args, "title");
  if (!title) die("--title is required", 1);
  const priority = flag(args, "priority");
  const attachments = flagList(args, "attach");

  const body: Record<string, unknown> = { title };
  if (priority) body.priority = priority;
  if (attachments.length > 0) body.attachments = attachments;

  const res = await apiClient<{ id?: string; error?: string }>("POST", "/cards", body);
  if (!res.ok) {
    die(`create failed (${res.status}): ${JSON.stringify(res.body)}`, 1);
  }
  const id = (res.body as { id: string }).id;
  out(`created ${id}`);
}

async function cmdMove(args: ParsedArgs): Promise<void> {
  const [id, state] = args.positional;
  if (!id || !state) die("usage: board move <id> <state>", 1);

  const res = await apiClient<{ failures?: string[]; error?: string }>(
    "POST",
    `/cards/${id}/move`,
    { state },
  );

  if (res.status === 422) {
    const failures = (res.body as { failures?: string[] }).failures ?? [JSON.stringify(res.body)];
    for (const f of failures) {
      process.stdout.write(f + "\n");
    }
    process.exit(1);
  }
  if (!res.ok) {
    die(`move failed (${res.status}): ${JSON.stringify(res.body)}`, 2);
  }
  out(`moved ${id} to ${state}`);
}

async function cmdUpdate(args: ParsedArgs): Promise<void> {
  const [id] = args.positional;
  if (!id) die("usage: board update <id> [options]", 1);

  const body: Record<string, unknown> = {};
  const title = flag(args, "title");
  const priority = flag(args, "priority");
  const log = flag(args, "log");
  const attachments = flagList(args, "attach");
  const workdir = flag(args, "workdir");

  if (title) body.title = title;
  if (priority) body.priority = priority;
  if (log) body.workLogEntry = { message: log, timestamp: new Date().toISOString() };
  if (workdir) body.workDir = workdir;

  // Send the base update (without attachments)
  const res = await apiClient<{ error?: string }>("PATCH", `/cards/${id}`, body);
  if (!res.ok) {
    die(`update failed (${res.status}): ${JSON.stringify(res.body)}`, 1);
  }

  // Send each attachment individually as { path, name } objects
  for (const p of attachments) {
    const name = p.split("/").pop() ?? p;
    const aRes = await apiClient<{ error?: string }>("PATCH", `/cards/${id}`, { attachment: { path: p, name } });
    if (!aRes.ok) {
      die(`attachment failed (${aRes.status}): ${JSON.stringify(aRes.body)}`, 1);
    }
  }

  out(`updated ${id}`);
}

async function cmdShow(args: ParsedArgs): Promise<void> {
  const [id] = args.positional;
  if (!id) die("usage: board show <id>", 1);

  const res = await apiClient<Record<string, unknown>>("GET", `/cards/${id}`);
  if (res.status === 404) die(`card not found: ${id}`, 1);
  if (!res.ok) die(`show failed (${res.status}): ${JSON.stringify(res.body)}`, 2);

  const card = res.body as {
    id: string;
    title: string;
    state: string;
    priority: string;
    attachments?: string[];
    workLog?: Array<{ message: string; timestamp: string }>;
    workDir?: string;
    createdAt: string;
    updatedAt: string;
    inProgressAt?: string;
    inReviewAt?: string;
    shippedAt?: string;
  };

  function fmtDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }

  const lines: string[] = [
    "---",
    `id: ${card.id}`,
    `title: ${card.title}`,
    `state: ${card.state}`,
    `priority: ${card.priority}`,
    `created: ${card.createdAt}`,
    `updated: ${card.updatedAt}`,
  ];
  if (card.workDir) lines.push(`workDir: ${card.workDir}`);
  if (card.attachments?.length) {
    lines.push(`attachments:\n${card.attachments.map((a) => `  - ${a}`).join("\n")}`);
  }

  // Timing fields
  const createdMs = new Date(card.createdAt).getTime();
  if (card.inProgressAt) {
    const waitMs = new Date(card.inProgressAt).getTime() - createdMs;
    lines.push(`inProgressAt: ${card.inProgressAt}  (waited ${fmtDuration(waitMs)} in backlog)`);
  }
  if (card.inReviewAt) {
    const base = card.inProgressAt ? new Date(card.inProgressAt).getTime() : createdMs;
    const dur = new Date(card.inReviewAt).getTime() - base;
    lines.push(`inReviewAt: ${card.inReviewAt}  (${fmtDuration(dur)} in-progress)`);
  }
  if (card.shippedAt) {
    const base = card.inReviewAt
      ? new Date(card.inReviewAt).getTime()
      : card.inProgressAt
        ? new Date(card.inProgressAt).getTime()
        : createdMs;
    const dur = new Date(card.shippedAt).getTime() - base;
    const total = new Date(card.shippedAt).getTime() - createdMs;
    lines.push(`shippedAt: ${card.shippedAt}  (${fmtDuration(dur)} in-review, ${fmtDuration(total)} total)`);
  }

  lines.push("---", "");

  const workLog = card.workLog ?? [];
  if (workLog.length > 0) {
    lines.push("## Work Log", "");
    for (const entry of workLog) {
      lines.push(`**${entry.timestamp}** — ${entry.message}`, "");
    }
  }

  out(lines.join("\n"));
}

async function cmdSearch(args: ParsedArgs): Promise<void> {
  const params = new URLSearchParams();
  const state = flag(args, "state");
  const priority = flag(args, "priority");
  const text = flag(args, "text");
  const all = flag(args, "all");

  if (state) params.set("state", state);
  if (priority) params.set("priority", priority);
  if (text) params.set("text", text);
  if (all) params.set("all", "true");

  const qs = params.toString();
  const res = await apiClient<unknown[]>("GET", `/cards${qs ? `?${qs}` : ""}`);
  if (!res.ok) die(`search failed (${res.status}): ${JSON.stringify(res.body)}`, 2);

  const cards = res.body as Array<{
    id: string;
    title: string;
    state: string;
    priority: string;
  }>;

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  cards.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));

  if (cards.length === 0) {
    out("(no cards found)");
    return;
  }

  const idW = Math.max(4, ...cards.map((c) => c.id.length));
  const titleW = Math.max(5, ...cards.map((c) => c.title.length));
  const stateW = Math.max(5, ...cards.map((c) => c.state.length));
  const priW = Math.max(8, ...cards.map((c) => c.priority.length));

  const row = (id: string, title: string, state: string, pri: string) =>
    `${id.padEnd(idW)}  ${title.padEnd(titleW)}  ${state.padEnd(stateW)}  ${pri.padEnd(priW)}`;

  out(row("ID", "TITLE", "STATE", "PRIORITY"));
  out(row("-".repeat(idW), "-".repeat(titleW), "-".repeat(stateW), "-".repeat(priW)));
  for (const c of cards) {
    out(row(c.id, c.title, c.state, c.priority));
  }
}

async function cmdArchive(args: ParsedArgs): Promise<void> {
  const [id] = args.positional;
  if (!id) die("usage: board archive <id> [--reason <msg>]", 1);
  const reason = flag(args, "reason");

  const body: Record<string, unknown> = {};
  if (reason) body.reason = reason;

  const res = await apiClient<{ error?: string }>("POST", `/cards/${id}/archive`, body);
  if (!res.ok) die(`archive failed (${res.status}): ${JSON.stringify(res.body)}`, 1);
  out(`archived ${id}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.length === 0) {
  process.stderr.write(
    "Usage: board <command> [options]\n" +
      "Commands: create, move, update, show, search, archive\n",
  );
  process.exit(1);
}

const [command, ...rest] = argv;
const args = parseArgs(rest);

switch (command) {
  case "create":
    await cmdCreate(args);
    break;
  case "move":
    await cmdMove(args);
    break;
  case "update":
    await cmdUpdate(args);
    break;
  case "show":
    await cmdShow(args);
    break;
  case "search":
    await cmdSearch(args);
    break;
  case "archive":
    await cmdArchive(args);
    break;
  default:
    die(`unknown command: ${command}. Valid: create, move, update, show, search, archive`, 1);
}
