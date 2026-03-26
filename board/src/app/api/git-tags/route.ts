import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface GitVersion {
  tag: string;       // raw tag (e.g. "0.0.12-self-building-board")
  version: string;   // normalized (e.g. "v0.0.12")
  label: string;     // human label (e.g. "v0.0.12 — self-building-board")
  date: string;      // ISO date of the tagged commit
  message: string;   // commit subject
}

function normalizeVersion(tag: string): string {
  // Strip trailing slug (e.g. "0.0.12-self-building-board" → "v0.0.12")
  const m = tag.match(/^v?([\d]+\.[\d]+\.[\d]+)/);
  return m ? `v${m[1]}` : tag.startsWith('v') ? tag : `v${tag}`;
}

export async function GET() {
  try {
    const repoRoot = path.resolve(process.cwd(), '..');
    const raw = execSync(
      `git -C "${repoRoot}" tag --sort=version:refname`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (!raw) return NextResponse.json([]);

    const tags = raw.split('\n').filter(Boolean);
    const versions: GitVersion[] = [];

    for (const tag of tags) {
      try {
        const commit = execSync(
          `git -C "${repoRoot}" rev-list -n 1 "${tag}"`,
          { encoding: 'utf8', timeout: 3000 }
        ).trim();

        const date = execSync(
          `git -C "${repoRoot}" log -1 --format="%aI" "${commit}"`,
          { encoding: 'utf8', timeout: 3000 }
        ).trim();

        const message = execSync(
          `git -C "${repoRoot}" log -1 --format="%s" "${commit}"`,
          { encoding: 'utf8', timeout: 3000 }
        ).trim();

        const version = normalizeVersion(tag);
        const slug = tag.replace(/^v?[\d]+\.[\d]+\.[\d]+-?/, '');
        const label = slug ? `${version} — ${slug.replace(/-/g, ' ')}` : version;

        versions.push({ tag, version, label, date, message });
      } catch {
        // skip malformed tag
      }
    }

    return NextResponse.json(versions);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
