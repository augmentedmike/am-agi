import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Returns the absolute path to the AM installation directory.
 *
 * Set by the installer via the `AM_INSTALL_DIR` env var on the launchagent /
 * systemd unit. Falls back to `$HOME/am-agi` for development setups where the
 * env var isn't injected.
 */
export function getInstallDir(): string {
  return process.env.AM_INSTALL_DIR ?? path.join(homedir(), 'am-agi');
}

/**
 * Returns the install dir as a tilde-prefixed path (e.g. `~/am-agi`) for
 * displaying to users or storing as a portable default in settings/DB rows.
 * If the install dir is not under $HOME, returns the absolute path.
 */
export function getInstallDirTilde(): string {
  const home = homedir();
  const dir = getInstallDir();
  if (dir === home) return '~';
  if (dir.startsWith(home + path.sep)) return '~' + dir.slice(home.length);
  return dir;
}
