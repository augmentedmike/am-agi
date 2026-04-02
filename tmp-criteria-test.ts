import { readFileSync } from "fs";

const criteria = readFileSync("/Users/michaeloneal/am/workspaces/cards/7a5ee709-1476-4a02-8b94-a9693d5e88aa/criteria.md", "utf8");
const log = readFileSync("/Users/michaeloneal/am/worktrees/7a5ee709-1476-4a02-8b94-a9693d5e88aa/iter/2/agent.log", "utf8");
console.log("Log first 100 chars:", log.slice(0, 100));

const criterionLines = criteria
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => (l.startsWith("- ") && l.length > 2) || /^\d+\.\s/.test(l))
  .map((l) => l.startsWith("- ") ? l.slice(2).trim() : l.replace(/^\d+\.\s+/, "").trim());

console.log("Criteria count:", criterionLines.length);
for (const criterion of criterionLines) {
  const escaped = criterion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const passPattern = new RegExp(`(✓|\\[pass\\]).*${escaped}|${escaped}.*(✓|\\[pass\\])`, "i");
  const pass = passPattern.test(log);
  console.log(pass ? "PASS" : "FAIL", criterion.slice(0, 70));
}
