import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

export interface HarnessToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface HarnessToolResult {
  toolCallId: string;
  name: string;
  content: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ToolRuntime {
  workDir: string;
  timeoutMs: number;
}

export const HARNESS_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "shell",
      description: "Run a shell command in the workspace. Use this for tests, git, build commands, and safe inspection.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          cwd: { type: "string", description: "Optional workspace-relative directory." },
          timeoutMs: { type: "number", description: "Optional timeout in milliseconds." },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 file from the workspace.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or replace a UTF-8 file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files and directories at a workspace-relative path.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
];

export async function runHarnessTool(call: HarnessToolCall, runtime: ToolRuntime): Promise<HarnessToolResult> {
  try {
    const args = parseArgs(call.argumentsJson);
    const content = await dispatchTool(call.name, args, runtime);
    return { toolCallId: call.id, name: call.name, content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { toolCallId: call.id, name: call.name, content: `ERROR: ${message}` };
  }
}

async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  runtime: ToolRuntime,
): Promise<string> {
  if (name === "shell") return runShell(args, runtime);
  if (name === "read_file") return readWorkspaceFile(args, runtime.workDir);
  if (name === "write_file") return writeWorkspaceFile(args, runtime.workDir);
  if (name === "list_dir") return listWorkspaceDir(args, runtime.workDir);
  throw new Error(`unknown tool: ${name}`);
}

async function runShell(args: Record<string, unknown>, runtime: ToolRuntime): Promise<string> {
  const command = requireString(args.command, "command");
  const cwdArg = typeof args.cwd === "string" ? args.cwd : ".";
  const cwd = resolveInside(runtime.workDir, cwdArg);
  const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : runtime.timeoutMs;
  const proc = Bun.spawn(["zsh", "-lc", command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const timeout = setTimeout(() => {
    proc.kill();
  }, timeoutMs);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timeout);

  return truncate([
    `exitCode: ${exitCode}`,
    stdout ? `stdout:\n${stdout}` : "stdout: <empty>",
    stderr ? `stderr:\n${stderr}` : "stderr: <empty>",
  ].join("\n\n"));
}

async function readWorkspaceFile(args: Record<string, unknown>, workDir: string): Promise<string> {
  const filePath = resolveInside(workDir, requireString(args.path, "path"));
  return truncate(await readFile(filePath, "utf8"));
}

async function writeWorkspaceFile(args: Record<string, unknown>, workDir: string): Promise<string> {
  const filePath = resolveInside(workDir, requireString(args.path, "path"));
  const content = requireString(args.content, "content");
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return `wrote ${relative(workDir, filePath)} (${content.length} bytes)`;
}

async function listWorkspaceDir(args: Record<string, unknown>, workDir: string): Promise<string> {
  const dirPath = resolveInside(workDir, requireString(args.path, "path"));
  const entries = await readdir(dirPath);
  const lines: string[] = [];
  for (const entry of entries.sort()) {
    const entryPath = resolve(dirPath, entry);
    const info = await stat(entryPath);
    lines.push(`${info.isDirectory() ? "dir " : "file"} ${entry}`);
  }
  return lines.join("\n");
}

function parseArgs(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("tool arguments must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function resolveInside(workDir: string, inputPath: string): string {
  const resolvedRoot = resolve(workDir);
  const resolvedPath = resolve(resolvedRoot, inputPath);
  const rel = relative(resolvedRoot, resolvedPath);
  if (rel === ".." || rel.startsWith("../")) {
    if (rel !== "") throw new Error(`path escapes workspace: ${inputPath}`);
  }
  return resolvedPath;
}

function truncate(value: string, max = 40_000): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n\n<truncated ${value.length - max} chars>`;
}
