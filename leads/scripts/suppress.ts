#!/usr/bin/env bun
/**
 * suppress.ts — Remove suppressed emails from a leads CSV before sending
 *
 * Usage:
 *   bun run leads/scripts/suppress.ts \
 *     --input  leads/leads.csv \
 *     --suppress leads/suppression.csv \
 *     --output leads/leads-sendable.csv
 *
 * Also accepts: --add <email> [--reason <text>]
 *   Adds an email to suppression.csv (for manual opt-out additions)
 */

import { readFile, writeFile, appendFile } from "fs/promises";
import { existsSync } from "fs";

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
  const get = (flag: string) => args.find((_, i) => args[i - 1] === flag);

  const suppressFile = get("--suppress") ?? "./leads/suppression.csv";

  // Handle --add mode
  const addEmail = get("--add");
  if (addEmail) {
    const reason = get("--reason") ?? "manual";
    const date = new Date().toISOString().slice(0, 10);
    const line = `"${addEmail}","${reason}","${date}"\n`;

    if (!existsSync(suppressFile)) {
      await writeFile(suppressFile, "email,reason,date_added\n" + line);
    } else {
      await appendFile(suppressFile, line);
    }
    console.log(`✓ Added ${addEmail} to suppression list`);
    return;
  }

  const inputFile = get("--input") ?? "./leads/leads.csv";
  const outputFile = get("--output") ?? "./leads/leads-sendable.csv";

  // Load suppression list
  const suppressed = new Set<string>();
  if (existsSync(suppressFile)) {
    const suppText = await readFile(suppressFile, "utf-8");
    const { rows } = parseCSV(suppText);
    for (const row of rows) {
      const email = (row["email"] ?? "").toLowerCase().trim();
      if (email) suppressed.add(email);
    }
  }

  // Load leads
  const leadsText = await readFile(inputFile, "utf-8");
  const { rows } = parseCSV(leadsText);

  const kept: Record<string, string>[] = [];
  let removed = 0;

  for (const row of rows) {
    const email = (row["email"] ?? "").toLowerCase().trim();
    if (suppressed.has(email)) {
      removed++;
    } else {
      kept.push(row);
    }
  }

  const STANDARD_COLS = ["company_name", "website", "email", "vertical", "city", "state", "source", "verified"];
  const header = STANDARD_COLS.join(",") + "\n";
  const body = kept.map(row =>
    STANDARD_COLS.map(col => `"${(row[col] ?? "").replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");

  await writeFile(outputFile, header + body + "\n");

  console.log(`✓ Suppression applied → ${outputFile}`);
  console.log(`  Total leads: ${rows.length}`);
  console.log(`  Suppressed:  ${removed}`);
  console.log(`  Sendable:    ${kept.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
