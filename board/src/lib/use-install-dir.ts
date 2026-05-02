'use client';

import { useEffect, useState } from 'react';

const FALLBACK = '~/am-agi';
let cached: string | null = null;
let inflight: Promise<string> | null = null;

/**
 * Returns the install dir reported by `/api/settings` (set by the installer
 * via `AM_INSTALL_DIR`). Cached across all callers — the value is fixed at
 * install time so a single fetch suffices for the lifetime of the page.
 */
export function useInstallDir(): string {
  const [dir, setDir] = useState<string>(cached ?? FALLBACK);
  useEffect(() => {
    if (cached) { setDir(cached); return; }
    if (!inflight) {
      inflight = fetch('/api/settings')
        .then((r) => r.json())
        .then((s: Record<string, string>) => {
          cached = s.install_dir || FALLBACK;
          return cached;
        })
        .catch(() => FALLBACK);
    }
    inflight.then(setDir);
  }, []);
  return dir;
}
