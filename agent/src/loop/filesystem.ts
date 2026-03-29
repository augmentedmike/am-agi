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
  /** Write content to a file, creating or overwriting it. */
  writeFile(path: string, content: string): Promise<void>;
  /** Append content to a file, creating it if it does not exist. */
  appendFile(path: string, content: string): Promise<void>;
  /** Create a directory and any missing parent directories. */
  mkdir(path: string): Promise<void>;
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

  async writeFile(path: string, content: string): Promise<void> {
    await Bun.write(path, content);
  }

  async appendFile(path: string, content: string): Promise<void> {
    const existing = (await Bun.file(path).exists())
      ? await Bun.file(path).text()
      : "";
    await Bun.write(path, existing + content);
  }

  async mkdir(path: string): Promise<void> {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path, { recursive: true });
  }
}
