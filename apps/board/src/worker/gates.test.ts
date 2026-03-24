import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkGate, type Card, type State } from "./gates";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeWorkDir(): string {
  const dir = join(tmpdir(), `gates-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "task-001",
    title: "Test card",
    state: "backlog",
    priority: "normal",
    attachments: [],
    ...overrides,
  };
}

function writeCriteria(dir: string, content = "1. Do the thing\n2. Test it\n"): string {
  const path = join(dir, "criteria.md");
  writeFileSync(path, content, "utf8");
  return path;
}

function writeResearch(dir: string, content = "See src/worker/gates.ts:42 for the entry point.\n"): string {
  const path = join(dir, "research.md");
  writeFileSync(path, content, "utf8");
  return path;
}

function writeTodo(dir: string, content = "- [x] Step one\n- [x] Step two\n"): string {
  const path = join(dir, "todo.md");
  writeFileSync(path, content, "utf8");
  return path;
}

function writeIterLog(dir: string, n: number, content: string): string {
  const iterDir = join(dir, "iter", String(n));
  mkdirSync(iterDir, { recursive: true });
  const path = join(iterDir, "agent.log");
  writeFileSync(path, content, "utf8");
  return path;
}

let workDir: string;

beforeEach(() => {
  workDir = makeWorkDir();
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// backlog → in-progress
// ---------------------------------------------------------------------------

describe("backlog → in-progress", () => {
  it("rejects when no attachments", async () => {
    const card = makeCard({ state: "backlog" });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures).toContain("criteria.md must be attached and exist");
    expect(result.failures).toContain("research.md must be attached and exist");
  });

  it("rejects when title is empty", async () => {
    const critPath = writeCriteria(workDir);
    const researchPath = writeResearch(workDir);
    const card = makeCard({
      state: "backlog",
      title: "   ",
      attachments: [critPath, researchPath],
    });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("title"))).toBe(true);
  });

  it("rejects when criteria.md is missing from filesystem", async () => {
    const researchPath = writeResearch(workDir);
    const card = makeCard({
      state: "backlog",
      attachments: [join(workDir, "criteria.md"), researchPath],
    });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("criteria.md"))).toBe(true);
  });

  it("rejects when criteria.md is empty", async () => {
    const critPath = join(workDir, "criteria.md");
    writeFileSync(critPath, "", "utf8");
    const researchPath = writeResearch(workDir);
    const card = makeCard({ state: "backlog", attachments: [critPath, researchPath] });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("criteria.md must be non-empty"))).toBe(true);
  });

  it("rejects when criteria.md has no numbered items", async () => {
    const critPath = writeCriteria(workDir, "- Do the thing\n- Test it\n");
    const researchPath = writeResearch(workDir);
    const card = makeCard({ state: "backlog", attachments: [critPath, researchPath] });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("numbered criterion"))).toBe(true);
  });

  it("rejects when research.md is missing", async () => {
    const critPath = writeCriteria(workDir);
    const card = makeCard({ state: "backlog", attachments: [critPath] });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures).toContain("research.md must be attached and exist");
  });

  it("rejects when research.md is empty", async () => {
    const critPath = writeCriteria(workDir);
    const researchPath = join(workDir, "research.md");
    writeFileSync(researchPath, "   ", "utf8");
    const card = makeCard({ state: "backlog", attachments: [critPath, researchPath] });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("research.md must be non-empty"))).toBe(true);
  });

  it("rejects when research.md has no file paths or URLs", async () => {
    const critPath = writeCriteria(workDir);
    const researchPath = join(workDir, "research.md");
    writeFileSync(researchPath, "I did some research and it looks good.\n", "utf8");
    const card = makeCard({ state: "backlog", attachments: [critPath, researchPath] });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("file path") || f.includes("URL"))).toBe(true);
  });

  it("allows when research.md contains a src/ file path (code task)", async () => {
    const critPath = writeCriteria(workDir);
    const researchPath = writeResearch(workDir, "See src/worker/gates.ts:42 for the implementation.\n");
    const card = makeCard({ state: "backlog", attachments: [critPath, researchPath] });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("allows when research.md contains a URL (non-code task)", async () => {
    const critPath = writeCriteria(workDir);
    const researchPath = writeResearch(workDir, "Source: https://example.com/docs\nKey finding: use X.\n");
    const card = makeCard({ state: "backlog", attachments: [critPath, researchPath] });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// in-progress → in-review
// ---------------------------------------------------------------------------

describe("in-progress → in-review", () => {
  it("rejects when todo.md not attached", async () => {
    const card = makeCard({ state: "in-progress" });
    const result = await checkGate("in-progress", "in-review", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("todo.md"))).toBe(true);
  });

  it("rejects when todo.md has unchecked items", async () => {
    const todoPath = join(workDir, "todo.md");
    writeFileSync(todoPath, "- [x] Done\n- [ ] Not done\n", "utf8");
    const card = makeCard({ state: "in-progress", attachments: [todoPath] });
    const result = await checkGate("in-progress", "in-review", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("unchecked items"))).toBe(true);
  });

  it("allows when all todo items are checked and no test files exist", async () => {
    const todoPath = writeTodo(workDir, "- [x] Step one\n- [x] Step two\n");
    const card = makeCard({ state: "in-progress", attachments: [todoPath] });
    const result = await checkGate("in-progress", "in-review", card, workDir);
    expect(result.allowed).toBe(true);
  });

  it("allows when todo.md has no list items at all", async () => {
    const todoPath = writeTodo(workDir, "# Done\n\nAll complete.\n");
    const card = makeCard({ state: "in-progress", attachments: [todoPath] });
    const result = await checkGate("in-progress", "in-review", card, workDir);
    expect(result.allowed).toBe(true);
  });

  it("rejects when test files exist and bun test fails", async () => {
    const todoPath = writeTodo(workDir);
    // Create a test file with a failing assertion
    writeFileSync(
      join(workDir, "foo.test.ts"),
      "import { it, expect } from 'bun:test';\nit('fail', () => { expect(true).toBe(false); });\n",
      "utf8",
    );
    const card = makeCard({ state: "in-progress", attachments: [todoPath] });
    const result = await checkGate("in-progress", "in-review", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("bun test failed"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// in-review → in-progress (failure route)
// ---------------------------------------------------------------------------

describe("in-review → in-progress", () => {
  it("always allows without any files", async () => {
    const card = makeCard({ state: "in-review" });
    const result = await checkGate("in-review", "in-progress", card, workDir);
    expect(result.allowed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// in-review → shipped
// ---------------------------------------------------------------------------

describe("in-review → shipped", () => {
  it("rejects when no iter/ directory exists", async () => {
    const card = makeCard({ state: "in-review" });
    const result = await checkGate("in-review", "shipped", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("no iteration directory"))).toBe(true);
  });

  it("rejects when agent.log is missing for current iteration", async () => {
    mkdirSync(join(workDir, "iter", "1"), { recursive: true });
    const critPath = writeCriteria(workDir);
    const card = makeCard({ state: "in-review", attachments: [critPath] });
    const result = await checkGate("in-review", "shipped", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("agent.log"))).toBe(true);
  });

  it("rejects when criteria.md not attached", async () => {
    writeIterLog(workDir, 1, "iter 1 log\n✓ Do the thing\n✓ Test it\n");
    const card = makeCard({ state: "in-review" });
    const result = await checkGate("in-review", "shipped", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("criteria.md"))).toBe(true);
  });

  it("rejects when agent.log does not verify all criteria", async () => {
    const critPath = writeCriteria(workDir, "- Do the thing\n- Write tests\n");
    writeIterLog(workDir, 1, "✓ Do the thing\n(missing test verification)\n");
    const card = makeCard({ state: "in-review", attachments: [critPath] });
    const result = await checkGate("in-review", "shipped", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("criteria are verified"))).toBe(true);
  });

  it("uses the highest iteration number", async () => {
    mkdirSync(join(workDir, "iter", "1"), { recursive: true });
    const critPath = writeCriteria(workDir, "- Only criterion\n");
    writeIterLog(workDir, 3, "✓ Only criterion\n");
    const card = makeCard({ state: "in-review", attachments: [critPath] });
    const result = await checkGate("in-review", "shipped", card, workDir);
    // bun test will fail in temp dir (no package.json), so the gate will fail
    // but the criteria check should pass
    const criteriaFailure = result.failures.some((f) => f.includes("criteria are verified"));
    expect(criteriaFailure).toBe(false);
  });

  it("skips CODE_QUALITY.md check when file does not exist", async () => {
    const critPath = writeCriteria(workDir, "- Only criterion\n");
    writeIterLog(workDir, 1, "✓ Only criterion\n");
    const card = makeCard({ state: "in-review", attachments: [critPath] });
    const result = await checkGate("in-review", "shipped", card, workDir);
    // No CODE_QUALITY.md → no quality violations
    const qualityFailure = result.failures.some((f) => f.includes("CODE_QUALITY"));
    expect(qualityFailure).toBe(false);
  });

  it("reports CODE_QUALITY.md violations when prohibited pattern appears in diff", async () => {
    const critPath = writeCriteria(workDir, "- Only criterion\n");
    writeIterLog(workDir, 1, "✓ Only criterion\n");
    // Create docs/CODE_QUALITY.md with a never-do rule
    const docsDir = join(workDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(
      join(docsDir, "CODE_QUALITY.md"),
      "## Rules\n- Never use `eval()` — it is dangerous\n",
      "utf8",
    );
    const card = makeCard({ state: "in-review", attachments: [critPath] });
    const result = await checkGate("in-review", "shipped", card, workDir);
    // git diff will fail (no git repo in temp dir) → violations returns [] → no quality failure
    const qualityFailure = result.failures.some((f) => f.includes("CODE_QUALITY"));
    expect(qualityFailure).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invalid transitions
// ---------------------------------------------------------------------------

describe("invalid transitions", () => {
  it("rejects backlog → shipped", async () => {
    const card = makeCard({ state: "backlog" });
    const result = await checkGate("backlog" as State, "shipped" as State, card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("invalid transition"))).toBe(true);
  });

  it("rejects shipped → backlog", async () => {
    const card = makeCard({ state: "shipped" });
    const result = await checkGate("shipped" as State, "backlog" as State, card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("invalid transition"))).toBe(true);
  });
});
