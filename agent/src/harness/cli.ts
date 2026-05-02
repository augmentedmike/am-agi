#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { runAmHarness } from "./session.ts";

interface ParsedArgs {
  command: string;
  flags: Record<string, string>;
  positional: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0]?.startsWith("-") ? "run" : (argv.shift() ?? "run");
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = "true";
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }
  return { command, flags, positional };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "help" || args.flags.help === "true") {
    printHelp();
    return;
  }
  if (args.command !== "run") {
    throw new Error(`unknown command: ${args.command}`);
  }

  const workDir = resolve(args.flags.workdir ?? args.flags.cwd ?? process.cwd());
  const message = args.flags.message;
  if (message) {
    appendFileSync(join(workDir, "user-notes.md"), `\n<!-- ${new Date().toISOString()} -->\n${message}\n`, "utf8");
  }

  const positionalPrompt = args.positional.join(" ");
  const prompt = args.flags.prompt ?? (positionalPrompt.length > 0 ? positionalPrompt : undefined);

  const result = await runAmHarness({
    workDir,
    provider: args.flags.provider,
    model: args.flags.model,
    baseUrl: args.flags["base-url"],
    apiKey: args.flags["api-key"],
    apiKeyEnv: args.flags["api-key-env"],
    prompt,
    maxSteps: parseNumber(args.flags["max-steps"]),
    toolTimeoutMs: parseNumber(args.flags["tool-timeout-ms"]),
  });

  if (args.flags.json === "true") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(result.result.endsWith("\n") ? result.result : `${result.result}\n`);
  }
  process.exit(result.exitCode);
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`invalid numeric flag: ${value}`);
  }
  return parsed;
}

function printHelp(): void {
  process.stdout.write(`am-cli

Usage:
  am-cli run [prompt] [--workdir <path>] [--provider codex|openai|deepseek|qwen|openrouter|local]

Provider auth:
  codex/openai  OPENAI_API_KEY or AM_OPENAI_API_KEY
  deepseek      DEEPSEEK_API_KEY or AM_DEEPSEEK_API_KEY
  qwen          DASHSCOPE_API_KEY, QWEN_API_KEY, or AM_QWEN_API_KEY
  openrouter    OPENROUTER_API_KEY or AM_OPENROUTER_API_KEY
  local         no key required by default

Flags:
  --model <id>             Override provider default model
  --base-url <url>         Override OpenAI-compatible base URL
  --api-key-env <name>     Read API key from a specific env var
  --api-key <value>        Pass API key directly
  --message <text>         Append text to user-notes.md before running
  --max-steps <n>          Max model/tool turns, default 20
  --json                   Print structured result
`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`am-cli: ${message}\n`);
  process.exit(1);
});
