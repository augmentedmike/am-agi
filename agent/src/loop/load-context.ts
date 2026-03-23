import { join } from "node:path";
import type { FileSystem } from "./filesystem";
import type { WorkContext } from "./types";

/**
 * READ step — load work.md (required) and optionally criteria.md and todo.md
 * from the given work directory.
 *
 * Throws a descriptive error if work.md is missing.
 */
export async function loadContext(workDir: string, fs: FileSystem): Promise<WorkContext> {
  const workPath = join(workDir, "work.md");

  if (!(await fs.exists(workPath))) {
    throw new Error(
      `loadContext: required file not found: ${workPath}`,
    );
  }

  const workMd = await fs.readFile(workPath);

  const criteriaPath = join(workDir, "criteria.md");
  const criteriaMd = (await fs.exists(criteriaPath))
    ? await fs.readFile(criteriaPath)
    : undefined;

  const todoPath = join(workDir, "todo.md");
  const todoMd = (await fs.exists(todoPath))
    ? await fs.readFile(todoPath)
    : undefined;

  return { workMd, criteriaMd, todoMd };
}
