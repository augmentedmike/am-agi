/**
 * FileSystem adapter interface.
 * All file I/O in the loop goes through this interface so the implementation
 * can be swapped out or extended without changing calling code.
 */
export interface FileSystem {
  /** Read a file and return its contents as a string. */
  readFile(path: string): Promise<string>;
  /** Return true if a file exists at the given path. */
  exists(path: string): Promise<boolean>;
}

/** Production implementation using Bun's built-in file APIs. */
export class BunFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    const file = Bun.file(path);
    return file.text();
  }

  async exists(path: string): Promise<boolean> {
    const file = Bun.file(path);
    return file.exists();
  }
}
