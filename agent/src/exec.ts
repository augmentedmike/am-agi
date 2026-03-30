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
export async function exec(cmd: string, opts: ExecOpts = {}): Promise<ExecResult> {
  const proc = Bun.spawn(["sh", "-c", cmd], {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}
