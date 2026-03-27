/** GitHub REST API utility functions (server-side only — token stays on server). */

export interface GitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  labels: { name: string; color: string }[];
  assignee: { login: string; avatar_url: string } | null;
  created_at: string;
}

export type PRStatus = 'open' | 'merged' | 'closed';

/** Extract PR number from a GitHub PR URL like https://github.com/owner/repo/pull/42 */
export function prNumberFromUrl(prUrl: string): number | null {
  const m = prUrl.match(/\/pull\/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

/** Extract owner/repo from a GitHub PR URL */
export function repoFromPrUrl(prUrl: string): string | null {
  const m = prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/);
  return m ? m[1] : null;
}

export async function getPR(token: string, ownerRepo: string, prNumber: number): Promise<GitHubPR> {
  const res = await fetch(`https://api.github.com/repos/${ownerRepo}/pulls/${prNumber}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub GET PR failed: ${res.status}`);
  return res.json() as Promise<GitHubPR>;
}

export function prStatus(pr: GitHubPR): PRStatus {
  if (pr.merged) return 'merged';
  if (pr.state === 'closed') return 'closed';
  return 'open';
}

export async function mergePR(token: string, ownerRepo: string, prNumber: number): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${ownerRepo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ merge_method: 'merge' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub merge PR failed: ${res.status} — ${body}`);
  }
}

export async function openPR(
  token: string,
  ownerRepo: string,
  head: string,
  base: string,
  title: string,
  body?: string,
): Promise<GitHubPR> {
  const res = await fetch(`https://api.github.com/repos/${ownerRepo}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body: body ?? '', head, base }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub open PR failed: ${res.status} — ${err}`);
  }
  return res.json() as Promise<GitHubPR>;
}

export async function getIssues(token: string, ownerRepo: string): Promise<GitHubIssue[]> {
  const res = await fetch(
    `https://api.github.com/repos/${ownerRepo}/issues?state=open&per_page=50`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
  );
  if (!res.ok) throw new Error(`GitHub list issues failed: ${res.status}`);
  const data = await res.json() as GitHubIssue[];
  // Filter out pull requests (issues API returns PRs too)
  return data.filter(i => !(i as unknown as { pull_request?: unknown }).pull_request);
}
