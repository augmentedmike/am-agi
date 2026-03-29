import { join } from "node:path";
import type { FileSystem } from "./filesystem";
import type { WorkContext } from "./types";
import type { StorageLayer } from "./storage";
import type { ProjectAdapter } from "./project-adapter";

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

/**
 * Load the adapter-specific domain context by delegating to the adapter's
 * `storageLayer.load()` method.
 *
 * This is a convenience wrapper that enforces the constraint at the type level:
 * the adapter must have a `storageLayer` property.
 *
 * @param adapter  A ProjectAdapter that declares a StorageLayer<T>.
 * @param workDir  Absolute path to the git worktree for this task.
 * @param fs       FileSystem implementation to use for all I/O.
 * @returns        The typed domain context loaded by the storage layer.
 *
 * @example
 * ```ts
 * const crmCtx = await loadDomainContext(new CrmPipelineAdapter(), workDir, fs);
 * ```
 */
export async function loadDomainContext<T>(
  adapter: ProjectAdapter & { storageLayer: StorageLayer<T> },
  workDir: string,
  fs: FileSystem,
): Promise<T> {
  return adapter.storageLayer.load(workDir, fs);
}
