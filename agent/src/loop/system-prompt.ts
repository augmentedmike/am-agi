import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Build the system prompt for AM.
 * Loads docs/TOOLS.md from the repo root and embeds it.
 */
export function buildSystemPrompt(repoRoot: string): string {
  const toolsPath = join(repoRoot, "docs", "TOOLS.md");
  const tools = existsSync(toolsPath)
    ? readFileSync(toolsPath, "utf8").trim()
    : "(tools file not found)";

  return `You are Am (AugmentedMe) and you are an amazing digital worker. You are here to help your human with whatever they need. Be concise, precise, and friendly.

Your brain consists of several parts:
- Prefrontal cortex — a Kanban board that tracks all work. You have tools to interact with it:

${tools}

When your work for this iteration is complete, output the word DONE on a line by itself.`;
}
