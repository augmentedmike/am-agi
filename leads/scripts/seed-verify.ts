#!/usr/bin/env bun
/**
 * seed-verify.ts — Mark seed dataset as "valid" (pre-verification placeholder)
 *
 * This is a ONE-TIME script for the seed dataset only.
 * Once NeverBounce verifies the list, run filter-verified.ts instead.
 *
 * Takes:  leads/leads-unverified.csv
 * Writes: leads/leads.csv           (verified="valid" for all records)
 *         leads/neverbounce-upload.csv  (just email column — for NeverBounce bulk upload)
 *
 * After getting NeverBounce results:
 *   1. Save results as leads/leads-verified-raw.csv
 *   2. bun run leads/scripts/filter-verified.ts
 *   3. This will overwrite leads.csv with real verification statuses
 */

import { readFile, writeFile } from "fs/promises";

const inFile = "./leads/leads-unverified.csv";
const outFile = "./leads/leads.csv";
const nbUploadFile = "./leads/neverbounce-upload.csv";

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

const STANDARD_COLS = ["company_name", "website", "email", "vertical", "city", "state", "source", "verified"];

async function main() {
  const text = await readFile(inFile, "utf-8");
  const { rows } = parseCSV(text);

  // Mark all as "valid" — placeholder until NeverBounce runs
  const verified = rows.map(r => ({ ...r, verified: "valid" }));

  // Write leads.csv
  const header = STANDARD_COLS.join(",") + "\n";
  const body = verified.map(row =>
    STANDARD_COLS.map(col => `"${(row[col] ?? "").replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");
  await writeFile(outFile, header + body + "\n");
  console.log(`✓ leads.csv written: ${verified.length} records (verified=valid seed placeholder)`);

  // Write NeverBounce upload file (email only — their bulk format)
  const nbLines = ["email", ...verified.map(r => r["email"] ?? "")].join("\n");
  await writeFile(nbUploadFile, nbLines + "\n");
  console.log(`✓ neverbounce-upload.csv written: ${verified.length} emails ready to upload`);
  console.log("\nNext steps for real verification:");
  console.log("  1. Go to https://app.neverbounce.com → Bulk Verify");
  console.log("  2. Upload leads/neverbounce-upload.csv");
  console.log("  3. Download results as leads/leads-verified-raw.csv");
  console.log("  4. bun run leads/scripts/filter-verified.ts");
}

main().catch(e => { console.error(e); process.exit(1); });
