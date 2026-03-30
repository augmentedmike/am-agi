#!/usr/bin/env bun
/**
 * cli.ts — thin CLI wrapper around runIteration.
 *
 * Usage:
 *   bun run agent/src/loop/cli.ts [--workdir <path>] [--message <text>]
 *
 * Flags:
 *   --workdir <path>   Absolute path to the git worktree. Defaults to cwd.
 *   --message <text>   Append text to user-notes.md before running iteration.
 */

import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runIteration } from "./index.ts";

function parseArgs(argv: string[]): { workDir: string; message: string | undefined } {
  let workDir = process.cwd();
  let message: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--workdir" && argv[i + 1]) {
      workDir = argv[++i];
    } else if (argv[i] === "--message" && argv[i + 1]) {
      message = argv[++i];
    }
  }

  return { workDir, message };
}

async function main(): Promise<void> {
  const { workDir, message } = parseArgs(process.argv.slice(2));

  if (message !== undefined) {
    const notesPath = join(workDir, "user-notes.md");
    const timestamp = new Date().toISOString();
    const entry = `\n<!-- ${timestamp} -->\n${message}\n`;
    appendFileSync(notesPath, entry, "utf8");
  }

  const result = await runIteration(workDir);
  process.stdout.write(result.result + "\n");
  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
