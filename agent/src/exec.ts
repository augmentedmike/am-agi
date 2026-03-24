import { spawn } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type ExecFn = (cmd: string, opts?: ExecOpts) => Promise<ExecResult>;

export interface ExecOpts {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Run a shell command via `sh -c`.
 * Throws only on spawn failure; non-zero exit codes are returned, not thrown.
 */
export function exec(cmd: string, opts: ExecOpts = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("sh", ["-c", cmd], {
      cwd: opts.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: opts.env ?? process.env,
    });

    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    child.stdout.on("data", (c: Buffer) => outChunks.push(c));
    child.stderr.on("data", (c: Buffer) => errChunks.push(c));
    child.on("error", (err) => reject(new Error(`exec spawn failed: ${err.message}`)));
    child.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(outChunks).toString("utf8"),
        stderr: Buffer.concat(errChunks).toString("utf8"),
        exitCode: code ?? 1,
      });
    });
  });
}
