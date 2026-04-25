import { createServer } from 'node:net';

/**
 * Returns true if `port` is currently free on 0.0.0.0 (any interface).
 * Probes by attempting to bind a server and immediately closing it.
 */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    try {
      server.listen(port, '0.0.0.0');
    } catch {
      resolve(false);
    }
  });
}

/**
 * Walks upward from `start` looking for a free TCP port, returning the first
 * one that is currently bindable. Throws if no free port is found within
 * `maxTries` candidates.
 */
export async function findFreePort(start: number, maxTries = 100): Promise<number> {
  for (let i = 0; i < maxTries; i++) {
    const candidate = start + i;
    if (candidate > 65535) break;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(candidate)) return candidate;
  }
  throw new Error(`no free port found starting at ${start}`);
}

/** Default base port used when a project has neither prodPort nor devPort set. */
export const DEFAULT_DEV_PORT_BASE = 4203;
