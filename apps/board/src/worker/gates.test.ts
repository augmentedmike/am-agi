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

function writeCriteria(dir: string, content = "- Do the thing\n- Test it\n"): string {
  const path = join(dir, "criteria.md");
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
    expect(result.failures).toContain("todo.md must be attached and exist");
  });

  it("rejects when criteria.md is attached but missing from filesystem", async () => {
    const card = makeCard({
      state: "backlog",
      attachments: [join(workDir, "criteria.md"), join(workDir, "todo.md")],
    });
    writeTodo(workDir);
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("criteria.md"))).toBe(true);
  });

  it("rejects when todo.md is empty", async () => {
    const critPath = writeCriteria(workDir);
    const todoPath = join(workDir, "todo.md");
    writeFileSync(todoPath, "   ", "utf8"); // whitespace only = empty
    const card = makeCard({
      state: "backlog",
      attachments: [critPath, todoPath],
    });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("todo.md must be non-empty"))).toBe(true);
  });

  it("rejects when criteria.md is empty", async () => {
    const critPath = join(workDir, "criteria.md");
    writeFileSync(critPath, "", "utf8");
    const todoPath = writeTodo(workDir);
    const card = makeCard({ state: "backlog", attachments: [critPath, todoPath] });
    const result = await checkGate("backlog", "in-progress", card, workDir);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((f) => f.includes("criteria.md must be non-empty"))).toBe(true);
  });

  it("allows when criteria.md and todo.md are attached and non-empty", async () => {
    const critPath = writeCriteria(workDir);
    const todoPath = writeTodo(workDir);
    const card = makeCard({ state: "backlog", attachments: [critPath, todoPath] });
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

  it("allows when all todo items are checked", async () => {
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
    // Create iter dir but no agent.log
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
    // iter/1 exists but iter/3 is current — should look for iter/3/agent.log
    mkdirSync(join(workDir, "iter", "1"), { recursive: true });
    const critPath = writeCriteria(workDir, "- Only criterion\n");
    writeIterLog(workDir, 3, "✓ Only criterion\n");
    const card = makeCard({ state: "in-review", attachments: [critPath] });
    const result = await checkGate("in-review", "shipped", card, workDir);
    // bun test will fail in temp dir (no package.json), so this will still fail
    // but the agent.log + criteria check should pass
    // We verify the criteria check specifically is not the failure reason
    const criteriaFailure = result.failures.some((f) => f.includes("criteria are verified"));
    expect(criteriaFailure).toBe(false);
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
