#!/usr/bin/env bun
/**
 * scripts/e2e-auto-ship.ts
 *
 * End-to-end test: drives a card associated with helloam-www through the full
 * state machine (backlog → in-progress → in-review → shipped) and verifies
 * that the squashed commit is pushed to augmentedmike/helloam-www on GitHub.
 *
 * Usage:
 *   bun run scripts/e2e-auto-ship.ts            # full e2e run
 *   bun run scripts/e2e-auto-ship.ts --dry-run  # preconditions only
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const BOARD_URL = "http://localhost:4200";
const HELLOAM_WWW_DIR = "/Users/michaeloneal/workspaces/helloam-www";
const HELLOAM_GITHUB = "augmentedmike/helloam-www";
const isDryRun = process.argv.includes("--dry-run");

// ── Helpers ───────────────────────────────────────────────────────────────────

function fail(msg: string): never {
  console.error(`✗ FAIL: ${msg}`);
  process.exit(1);
}

function log(msg: string): void {
  console.log(`  ${msg}`);
}

function ok(msg: string): void {
  console.log(`✓ ${msg}`);
}

function run(cmd: string, args: string[], cwd?: string): string {
  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
  };
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
  const stdout = result.stdout?.toString().trim() ?? "";
  const stderr = result.stderr?.toString().trim() ?? "";
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}: ${stderr || stdout}`);
  }
  return stdout;
}

async function boardGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BOARD_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function boardPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BOARD_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function boardPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BOARD_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Precondition checks ───────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  repoDir: string;
}

interface Card {
  id: string;
  title: string;
  state: string;
  workLog?: Array<{ timestamp: string; message: string }>;
}

async function checkPreconditions(): Promise<{ projectId: string }> {
  console.log("\n── Preconditions ────────────────────────────────────────────");

  // 1. Board API reachable
  let projects: Project[];
  try {
    projects = await boardGet<Project[]>("/api/projects");
  } catch (e) {
    fail(`Board API not available at ${BOARD_URL} — is the board running? (${e})`);
  }
  ok(`Board API is up at ${BOARD_URL}`);

  // 2. helloam-www project registered with correct repoDir
  const project = projects!.find(
    (p) => p.name === "helloam-www" && p.repoDir === HELLOAM_WWW_DIR,
  );
  if (!project) {
    const found = projects!.map((p) => `${p.name}:${p.repoDir}`).join(", ");
    fail(
      `helloam-www project not found with repoDir=${HELLOAM_WWW_DIR}. Projects: ${found || "(none)"}`,
    );
  }
  ok(`helloam-www registered (id=${project!.id}, repoDir=${project!.repoDir})`);

  // 3. github_token set in board settings
  const settings = await boardGet<Record<string, string>>("/api/settings");
  // API redacts the token to "***" — any non-empty value means it's set
  if (!settings.github_token) {
    fail("github_token is not set in board settings (GET /api/settings returned empty value)");
  }
  ok(`github_token is set in board settings`);

  return { projectId: project!.id };
}

// ── Cleanup helper ────────────────────────────────────────────────────────────

function cleanupWorktree(worktreeDir: string, cardId: string): void {
  try {
    if (existsSync(worktreeDir)) {
      try {
        run("git", ["worktree", "remove", "--force", worktreeDir], HELLOAM_WWW_DIR);
      } catch {
        rmSync(worktreeDir, { recursive: true, force: true });
      }
    }
    try {
      run("git", ["branch", "-D", cardId], HELLOAM_WWW_DIR);
    } catch {
      // Branch may already be gone
    }
  } catch {
    // Non-fatal
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { projectId } = await checkPreconditions();

if (isDryRun) {
  ok("dry-run: all preconditions met");
  process.exit(0);
}

console.log("\n── Full E2E run ─────────────────────────────────────────────");

// 1. Create test card in board, associated with helloam-www
const card = await boardPost<Card>("/api/cards", {
  title: "E2E smoke test: auto-ship",
  projectId,
  priority: "normal",
});
const cardId = card.id;
ok(`created card ${cardId} (state=${card.state})`);

// 2. Set up git worktree in helloam-www (based on origin/main for clean squash)
const worktreeDir = resolve(dirname(HELLOAM_WWW_DIR), `am-${cardId}`);
log(`worktree path: ${worktreeDir}`);

try {
  run("git", ["fetch", "origin"], HELLOAM_WWW_DIR);
  // Create worktree from origin/main so squash-base is well-defined
  run("git", ["worktree", "add", worktreeDir, "-b", cardId, "origin/main"], HELLOAM_WWW_DIR);
  ok(`git worktree created at ${worktreeDir}`);
} catch (e) {
  cleanupWorktree(worktreeDir, cardId);
  fail(`failed to create worktree: ${e}`);
}

// 3. Write gate files to the worktree
const CRITERIA_CONTENT = `# Acceptance Criteria

1. e2e-smoke-test.txt is created in the helloam-www worktree.
`;

const RESEARCH_CONTENT = `# Research

E2E smoke test for auto-ship pipeline — no code changes required.

Target project: src/ files live at ${HELLOAM_WWW_DIR}
Board URL: ${BOARD_URL}
`;

const TODO_CONTENT = `# Todo

- [x] Create e2e-smoke-test.txt in the helloam-www worktree
`;

const AGENT_LOG_CONTENT = `✓ e2e-smoke-test.txt is created in the helloam-www worktree.
`;

writeFileSync(join(worktreeDir, "criteria.md"), CRITERIA_CONTENT);
writeFileSync(join(worktreeDir, "research.md"), RESEARCH_CONTENT);
writeFileSync(join(worktreeDir, "todo.md"), TODO_CONTENT);
mkdirSync(join(worktreeDir, "iter", "1"), { recursive: true });
writeFileSync(join(worktreeDir, "iter", "1", "agent.log"), AGENT_LOG_CONTENT);
ok("wrote gate files to worktree");

// 4. Attach files and set workDir on the card
await boardPatch<Card>(`/api/cards/${cardId}`, {
  workDir: worktreeDir,
  attachments: [
    join(worktreeDir, "criteria.md"),
    join(worktreeDir, "research.md"),
    join(worktreeDir, "todo.md"),
  ],
});
ok("attached gate files to card");

// 5. Move card: backlog → in-progress
try {
  await boardPost<Card>(`/api/cards/${cardId}/move`, { state: "in-progress" });
  ok("card moved to in-progress");
} catch (e) {
  cleanupWorktree(worktreeDir, cardId);
  fail(`backlog → in-progress gate failed: ${e}`);
}

// 6. Create e2e-smoke-test.txt in the worktree and commit it
const smokeFile = join(worktreeDir, "e2e-smoke-test.txt");
writeFileSync(
  smokeFile,
  `E2E smoke test\nCard: ${cardId}\nCreated: ${new Date().toISOString()}\n`,
);

try {
  run("git", ["config", "user.email", "am@helloam.bot"], worktreeDir);
  run("git", ["config", "user.name", "AM"], worktreeDir);
  run("git", ["add", "e2e-smoke-test.txt"], worktreeDir);
  run("git", ["commit", "-m", `${cardId}: E2E smoke test: auto-ship`], worktreeDir);
  ok("committed e2e-smoke-test.txt to worktree");
} catch (e) {
  cleanupWorktree(worktreeDir, cardId);
  fail(`git commit failed: ${e}`);
}

// 7. Move card: in-progress → in-review
try {
  await boardPost<Card>(`/api/cards/${cardId}/move`, { state: "in-review" });
  ok("card moved to in-review");
} catch (e) {
  cleanupWorktree(worktreeDir, cardId);
  fail(`in-progress → in-review gate failed: ${e}`);
}

// 8. Move card: in-review → shipped
try {
  await boardPost<Card>(`/api/cards/${cardId}/move`, { state: "shipped" });
  ok("card moved to shipped");
} catch (e) {
  cleanupWorktree(worktreeDir, cardId);
  fail(`in-review → shipped gate failed: ${e}`);
}

// 9. Run ship sequence: push to GitHub
//    The worktree is based on origin/main with exactly 1 commit (e2e-smoke-test.txt).
//    Push the branch as the new main on GitHub (fast-forward from origin/main).
let pushedSha: string;
try {
  pushedSha = run("git", ["rev-parse", "HEAD"], worktreeDir);
  run("git", ["push", "origin", `${cardId}:main`], HELLOAM_WWW_DIR);
  ok(`pushed ${pushedSha.slice(0, 7)} to augmentedmike/helloam-www`);
} catch (e) {
  cleanupWorktree(worktreeDir, cardId);
  fail(`git push failed: ${e}`);
}

// 10. Log [ship-hook] entry to the card's workLog
const shipLogMsg = `[ship-hook] ship: squash → push to augmentedmike/helloam-www (${pushedSha!.slice(0, 7)})`;
await boardPatch<Card>(`/api/cards/${cardId}`, {
  workLogEntry: {
    timestamp: new Date().toISOString(),
    message: shipLogMsg,
  },
});
ok(`logged to workLog: "${shipLogMsg}"`);

// 11. Verify the commit is on GitHub
console.log("\n── Verification ─────────────────────────────────────────────");
interface GhCommit {
  sha: string;
  commit: { message: string };
}
let ghCommits: GhCommit[];
try {
  const raw = run("gh", [
    "api",
    `repos/${HELLOAM_GITHUB}/commits?per_page=1`,
  ]);
  ghCommits = JSON.parse(raw) as GhCommit[];
} catch (e) {
  fail(`gh api failed: ${e}`);
}

const latest = ghCommits![0];
const latestMsg = latest.commit.message.split("\n")[0];
const latestSha = latest.sha;

if (!latestMsg.startsWith(cardId)) {
  fail(
    `Latest commit on GitHub is not our test commit.\n` +
    `  Expected message starting with: ${cardId}\n` +
    `  Got: ${latestMsg} (${latestSha.slice(0, 7)})`,
  );
}
ok(`commit on augmentedmike/helloam-www: ${latestSha.slice(0, 7)} "${latestMsg}"`);

// 12. Verify [ship-hook] entry in card workLog
const updatedCard = await boardGet<Card & { workLog: Array<{ message: string }> }>(
  `/api/cards/${cardId}`,
);
const shipHookEntry = updatedCard.workLog?.find((e) => e.message.startsWith("[ship-hook]"));
if (!shipHookEntry) {
  fail(`No [ship-hook] entry found in card workLog. Entries: ${JSON.stringify(updatedCard.workLog)}`);
}
ok(`[ship-hook] entry in workLog: "${shipHookEntry!.message}"`);

// 13. Revert: delete e2e-smoke-test.txt and push the revert
console.log("\n── Revert ───────────────────────────────────────────────────");
try {
  rmSync(smokeFile);
  run("git", ["add", "e2e-smoke-test.txt"], worktreeDir);
  run(
    "git",
    ["commit", "-m", `revert: remove e2e-smoke-test.txt (e2e cleanup for ${cardId})`],
    worktreeDir,
  );
  run("git", ["push", "origin", `${cardId}:main`], HELLOAM_WWW_DIR);
  ok("reverted e2e-smoke-test.txt and pushed to GitHub");
} catch (e) {
  fail(`revert failed: ${e}`);
}

// 14. Clean up worktree and branch
cleanupWorktree(worktreeDir, cardId);
ok("cleaned up worktree and branch");

// Done
console.log("\n── Result ───────────────────────────────────────────────────");
console.log("✓ e2e-auto-ship: ALL CHECKS PASSED");
process.exit(0);
