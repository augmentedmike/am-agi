import type { WorkContext } from "./types";

/**
 * Build the prompt string to pass to Claude CLI.
 *
 * Always includes work.md. Appends criteria.md and todo.md sections when
 * those files are present so Claude has full iteration context.
 */
export function buildPrompt(ctx: WorkContext): string {
  const sections: string[] = [];

  sections.push(`## work.md\n\n${ctx.workMd}`);

  if (ctx.criteriaMd !== undefined) {
    sections.push(`## criteria.md\n\n${ctx.criteriaMd}`);
  }

  if (ctx.todoMd !== undefined) {
    sections.push(`## todo.md\n\n${ctx.todoMd}`);
  }

  if (ctx.userNotesMd !== undefined && ctx.userNotesMd.length > 0) {
    sections.push(`## User Notes\n\n${ctx.userNotesMd}`);
  }

  return sections.join("\n\n---\n\n");
}
