#!/usr/bin/env bun
/**
 * finalize.ts — Validate leads.csv and print a readiness report
 *
 * Run after filter-verified.ts to confirm the database meets all criteria
 * before moving the card to in-review.
 *
 * Usage: bun run leads/scripts/finalize.ts [--file ./leads/leads.csv]
 *
 * Exit codes:
 *   0 — all criteria met
 *   1 — one or more criteria not met (printed to stdout)
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";

const REQUIRED_COLS = ["company_name", "website", "email", "vertical", "city", "state", "source", "verified"];
const TARGET_VERTICALS = new Set(["agency", "ecommerce", "saas"]);
const MIN_LEADS = 1000;
const MIN_SOURCES = 3;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

interface CheckResult {
  pass: boolean;
  label: string;
  detail: string;
}

function check(pass: boolean, label: string, detail: string): CheckResult {
  return { pass, label, detail };
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => args.find((_, i) => args[i - 1] === flag);

  const leadsFile = get("--file") ?? "./leads/leads.csv";
  const suppressFile = get("--suppress") ?? "./leads/suppression.csv";

  const results: CheckResult[] = [];

  // Check files exist
  if (!existsSync(leadsFile)) {
    console.error(`Error: ${leadsFile} not found. Run the merge + verify pipeline first.`);
    process.exit(1);
  }

  const leadsText = await readFile(leadsFile, "utf-8");
  const { headers, rows } = parseCSV(leadsText);

  // Criterion 1: ≥1,000 records
  results.push(check(
    rows.length >= MIN_LEADS,
    `Record count ≥ ${MIN_LEADS}`,
    `Found ${rows.length} records`
  ));

  // Criterion 2: Required columns present
  const missingCols = REQUIRED_COLS.filter(c => !headers.includes(c));
  results.push(check(
    missingCols.length === 0,
    "All required columns present",
    missingCols.length === 0
      ? `Columns: ${REQUIRED_COLS.join(", ")}`
      : `Missing: ${missingCols.join(", ")}`
  ));

  // Criterion 3: No records missing email
  const noEmail = rows.filter(r => !r["email"] || !r["email"].includes("@")).length;
  results.push(check(
    noEmail === 0,
    "All records have valid email",
    noEmail === 0 ? "✓" : `${noEmail} records missing valid email`
  ));

  // Criterion 4: Target verticals covered (agency, ecommerce, saas)
  const verticals = new Set(rows.map(r => r["vertical"]?.toLowerCase()));
  const coveredTargets = [...TARGET_VERTICALS].filter(v => verticals.has(v));
  results.push(check(
    coveredTargets.length === TARGET_VERTICALS.size,
    "Target verticals covered (agency, ecommerce, saas)",
    `Covered: ${coveredTargets.join(", ")} | All verticals: ${[...verticals].join(", ")}`
  ));

  // Criterion 5: ≥3 distinct sources
  const sources = new Set(rows.map(r => r["source"]?.toLowerCase()).filter(Boolean));
  results.push(check(
    sources.size >= MIN_SOURCES,
    `≥ ${MIN_SOURCES} distinct lead sources`,
    `Sources: ${[...sources].join(", ")}`
  ));

  // Criterion 6: Verified column populated
  const unverified = rows.filter(r => !r["verified"] || r["verified"] === "").length;
  results.push(check(
    unverified === 0,
    "All records have verification status",
    unverified === 0 ? "✓" : `${unverified} records missing verified status`
  ));

  // Criterion 7: No invalid/disposable emails remain
  const invalid = rows.filter(r => ["invalid", "disposable", "spam_trap"].includes(r["verified"]?.toLowerCase())).length;
  results.push(check(
    invalid === 0,
    "No invalid/disposable emails in final list",
    invalid === 0 ? "✓" : `${invalid} invalid emails found — re-run filter-verified.ts`
  ));

  // Criterion 8: Suppression list exists
  results.push(check(
    existsSync(suppressFile),
    "Suppression list file exists",
    existsSync(suppressFile) ? suppressFile : `Not found: ${suppressFile}`
  ));

  // Print report
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║            LEADS DATABASE READINESS REPORT              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  let allPass = true;
  for (const r of results) {
    const icon = r.pass ? "✅" : "❌";
    console.log(`${icon}  ${r.label}`);
    console.log(`     ${r.detail}\n`);
    if (!r.pass) allPass = false;
  }

  // Vertical breakdown
  const verticalCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  for (const row of rows) {
    const v = row["vertical"] ?? "unknown";
    const s = row["source"] ?? "unknown";
    verticalCounts[v] = (verticalCounts[v] ?? 0) + 1;
    sourceCounts[s] = (sourceCounts[s] ?? 0) + 1;
  }
  console.log("Vertical breakdown:");
  for (const [v, n] of Object.entries(verticalCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.padEnd(15)} ${n}`);
  }
  console.log("\nSource breakdown:");
  for (const [s, n] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(15)} ${n}`);
  }

  console.log(`\nTotal records: ${rows.length}`);
  const validCount = rows.filter(r => r["verified"] === "valid").length;
  const catchallCount = rows.filter(r => r["verified"] === "catch-all").length;
  console.log(`  Verified valid:    ${validCount}`);
  console.log(`  Catch-all:         ${catchallCount}`);

  if (allPass) {
    console.log("\n🎉 All criteria met — ready to move to in-review.\n");
  } else {
    console.log("\n⚠  Some criteria not met. Collect more leads and re-run.\n");
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
