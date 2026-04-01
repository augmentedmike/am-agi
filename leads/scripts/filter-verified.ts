#!/usr/bin/env bun
/**
 * filter-verified.ts — Filter NeverBounce verification results
 *
 * Input:  leads/leads-verified-raw.csv  (after NeverBounce bulk verify)
 * Output: leads/leads.csv               (valid + catch-all only)
 *
 * NeverBounce result values:
 *   valid      → deliverable, include
 *   invalid    → hard bounce, remove
 *   catch-all  → server accepts all, include but flag as unverified
 *   unknown    → could not determine, include but flag
 *   disposable → temp address, remove
 *
 * Usage: bun run leads/scripts/filter-verified.ts [--in ./leads/leads-verified-raw.csv] [--out ./leads/leads.csv]
 */

import { readFile, writeFile } from "fs/promises";

const REMOVE_STATUSES = new Set(["invalid", "disposable", "spam_trap"]);
const CATCHALL_STATUS = "catch-all";

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

async function main() {
  const args = process.argv.slice(2);
  const inFile = args.find((_, i) => args[i - 1] === "--in") ?? "./leads/leads-verified-raw.csv";
  const outFile = args.find((_, i) => args[i - 1] === "--out") ?? "./leads/leads.csv";

  let text: string;
  try {
    text = await readFile(inFile, "utf-8");
  } catch {
    console.error(`Error: could not read ${inFile}`);
    console.error("Upload leads-unverified.csv to NeverBounce, download results as leads-verified-raw.csv, then re-run.");
    process.exit(1);
  }

  const { rows } = parseCSV(text);

  // NeverBounce may return the result in a column called "result", "nb_result", or "status"
  const resultKey = ["result", "nb_result", "status", "verification_result"].find(k =>
    rows[0] && k in rows[0]
  ) ?? "result";

  const stats = { valid: 0, catchall: 0, removed: 0, unknown: 0 };
  const kept: Record<string, string>[] = [];

  for (const row of rows) {
    const status = (row[resultKey] ?? "").toLowerCase().trim();

    if (REMOVE_STATUSES.has(status)) {
      stats.removed++;
      continue;
    }

    if (status === CATCHALL_STATUS) {
      row["verified"] = "catch-all";
      stats.catchall++;
    } else if (status === "valid") {
      row["verified"] = "valid";
      stats.valid++;
    } else {
      row["verified"] = status || "unknown";
      stats.unknown++;
    }

    kept.push(row);
  }

  // Output standard columns only
  const STANDARD_COLS = ["company_name", "website", "email", "vertical", "city", "state", "source", "verified"];
  const header = STANDARD_COLS.join(",") + "\n";
  const body = kept.map(row =>
    STANDARD_COLS.map(col => `"${(row[col] ?? "").replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");

  await writeFile(outFile, header + body + "\n");

  console.log(`✓ Filtered verification results → ${outFile}`);
  console.log(`  Valid:     ${stats.valid}`);
  console.log(`  Catch-all: ${stats.catchall}`);
  console.log(`  Removed:   ${stats.removed}`);
  console.log(`  Unknown:   ${stats.unknown}`);
  console.log(`  Total kept: ${kept.length}`);

  if (kept.length < 1000) {
    console.warn(`\n⚠ Warning: only ${kept.length} records — criteria requires ≥1,000 verified leads.`);
    console.warn("  Collect more leads and re-run the pipeline.");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
