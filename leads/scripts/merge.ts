#!/usr/bin/env bun
/**
 * merge.ts — Normalize and merge all raw CSVs from leads/raw/ into leads-unverified.csv
 *
 * Usage: bun run leads/scripts/merge.ts [--raw ./leads/raw] [--out ./leads/leads-unverified.csv]
 *
 * Each raw CSV may have varying column names. This script maps known aliases to
 * the standard schema: company_name, website, email, vertical, city, state, source, verified
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join, basename } from "path";

const VALID_VERTICALS = new Set(["agency", "ecommerce", "saas", "realestate", "legal", "other"]);
const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

// Column name aliases → standard name
const COLUMN_MAP: Record<string, string> = {
  // company_name
  "company": "company_name",
  "company name": "company_name",
  "business name": "company_name",
  "name": "company_name",
  "organization": "company_name",

  // website
  "website url": "website",
  "domain": "website",
  "url": "website",
  "company website": "website",
  "web": "website",

  // email
  "email address": "email",
  "work email": "email",
  "contact email": "email",
  "e-mail": "email",

  // vertical
  "industry": "vertical",
  "category": "vertical",
  "sector": "vertical",
  "type": "vertical",

  // city
  "location": "city",
  "town": "city",

  // state
  "state/province": "state",
  "province": "state",
  "region": "state",

  // source (we auto-set from filename if missing)
  "lead source": "source",
  "origin": "source",
};

const VERTICAL_MAP: Record<string, string> = {
  "marketing & advertising": "agency",
  "marketing and advertising": "agency",
  "advertising": "agency",
  "creative services": "agency",
  "public relations": "agency",
  "pr": "agency",
  "digital agency": "agency",
  "web design": "agency",
  "web development": "agency",
  "design": "agency",
  "consulting": "agency",
  "retail": "ecommerce",
  "e-commerce": "ecommerce",
  "consumer goods": "ecommerce",
  "information technology": "saas",
  "information technology & services": "saas",
  "software": "saas",
  "technology": "saas",
  "internet": "saas",
  "computer software": "saas",
  "real estate": "realestate",
  "property management": "realestate",
  "legal services": "legal",
  "law practice": "legal",
  "law firm": "legal",
  "attorney": "legal",
};

interface Lead {
  company_name: string;
  website: string;
  email: string;
  vertical: string;
  city: string;
  state: string;
  source: string;
  verified: string;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function normalizeColumn(rawName: string): string {
  const lower = rawName.trim().toLowerCase();
  return COLUMN_MAP[lower] ?? lower;
}

function normalizeVertical(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (VALID_VERTICALS.has(lower)) return lower;
  return VERTICAL_MAP[lower] ?? "other";
}

function normalizeState(raw: string): string {
  const upper = raw.trim().toUpperCase().slice(0, 2);
  return US_STATES.has(upper) ? upper : raw.trim().toUpperCase().slice(0, 2);
}

function normalizeWebsite(raw: string): string {
  if (!raw) return "";
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const u = new URL(url);
    return u.origin; // strip paths
  } catch {
    return url;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function inferSourceFromFilename(filename: string): string {
  const name = basename(filename, ".csv").toLowerCase();
  if (name.includes("apollo")) return "apollo";
  if (name.includes("clutch")) return "clutch";
  if (name.includes("upcity")) return "upcity";
  if (name.includes("chamber")) return "chamber";
  if (name.includes("outscraper") || name.includes("google")) return "outscraper";
  if (name.includes("yellowpages") || name.includes("yellow")) return "yellowpages";
  if (name.includes("hunter")) return "hunter";
  return name.split("-")[0] ?? "unknown";
}

async function main() {
  const args = process.argv.slice(2);
  const rawDir = args.find((_, i) => args[i - 1] === "--raw") ?? "./leads/raw";
  const outFile = args.find((_, i) => args[i - 1] === "--out") ?? "./leads/leads-unverified.csv";

  let files: string[];
  try {
    files = (await readdir(rawDir)).filter(f => f.endsWith(".csv"));
  } catch {
    console.error(`Error: could not read raw directory: ${rawDir}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log(`No CSV files found in ${rawDir}. Drop your raw exports there and re-run.`);
    process.exit(0);
  }

  const seen = new Set<string>(); // dedup by email
  const leads: Lead[] = [];
  let skippedNoEmail = 0;
  let skippedDuplicate = 0;

  for (const file of files) {
    const filepath = join(rawDir, file);
    const text = await readFile(filepath, "utf-8");
    const rows = parseCSV(text);
    const source = inferSourceFromFilename(file);
    let fileLeads = 0;

    for (const raw of rows) {
      // Normalize keys
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        row[normalizeColumn(k)] = v;
      }

      const email = (row["email"] ?? "").toLowerCase().trim();
      if (!email || !isValidEmail(email)) { skippedNoEmail++; continue; }
      if (seen.has(email)) { skippedDuplicate++; continue; }
      seen.add(email);

      leads.push({
        company_name: row["company_name"] ?? "",
        website: normalizeWebsite(row["website"] ?? ""),
        email,
        vertical: normalizeVertical(row["vertical"] ?? ""),
        city: row["city"] ?? "",
        state: normalizeState(row["state"] ?? ""),
        source: row["source"] || source,
        verified: row["verified"] ?? "",
      });
      fileLeads++;
    }

    console.log(`  ${file}: ${fileLeads} leads ingested`);
  }

  const header = "company_name,website,email,vertical,city,state,source,verified\n";
  const body = leads.map(l =>
    [l.company_name, l.website, l.email, l.vertical, l.city, l.state, l.source, l.verified]
      .map(v => `"${(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");

  await writeFile(outFile, header + body + "\n");

  console.log(`\n✓ Merged ${leads.length} unique leads → ${outFile}`);
  console.log(`  Skipped: ${skippedNoEmail} (no/invalid email), ${skippedDuplicate} (duplicate)`);

  const verticals: Record<string, number> = {};
  const sources: Record<string, number> = {};
  for (const l of leads) {
    verticals[l.vertical] = (verticals[l.vertical] ?? 0) + 1;
    sources[l.source] = (sources[l.source] ?? 0) + 1;
  }
  console.log("\nVertical breakdown:", verticals);
  console.log("Source breakdown:", sources);
}

main().catch(e => { console.error(e); process.exit(1); });
