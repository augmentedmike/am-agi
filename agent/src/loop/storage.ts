import type { FileSystem } from "./filesystem";

/**
 * StorageLayer<T> is the contract between an adapter and its persistent data.
 *
 * Each adapter that needs domain-specific storage implements this interface to
 * load its typed context at the start of an iteration and persist any output
 * produced during that iteration.
 *
 * @template T  The adapter-specific domain context type.
 *
 * @example
 * ```ts
 * class MyStorageLayer implements StorageLayer<MyDomainContext> {
 *   async load(workDir: string, fs: FileSystem): Promise<MyDomainContext> { ... }
 *   async persist(workDir: string, data: MyDomainContext, fs: FileSystem): Promise<void> { ... }
 * }
 * ```
 */
export interface StorageLayer<T> {
  /**
   * Load and return the typed domain context for this adapter.
   *
   * @param workDir  Absolute path to the git worktree for this task.
   * @param fs       FileSystem implementation to use for all I/O.
   */
  load(workDir: string, fs: FileSystem): Promise<T>;

  /**
   * Persist output produced during an iteration.
   *
   * @param workDir  Absolute path to the git worktree for this task.
   * @param data     The domain context (potentially mutated during the iteration).
   * @param fs       FileSystem implementation to use for all I/O.
   */
  persist(workDir: string, data: T, fs: FileSystem): Promise<void>;
}
