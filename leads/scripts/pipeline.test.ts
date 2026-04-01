/**
 * pipeline.test.ts — Unit tests for the leads data pipeline
 *
 * Tests core logic extracted from merge.ts, filter-verified.ts, and suppress.ts
 * without filesystem I/O.
 */

import { describe, it, expect } from "bun:test";

// ─── CSV parser (duplicated from scripts for isolated testing) ────────────────

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

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}

// ─── Normalization helpers ────────────────────────────────────────────────────

const VALID_VERTICALS = new Set(["agency", "ecommerce", "saas", "realestate", "legal", "other"]);
const VERTICAL_MAP: Record<string, string> = {
  "marketing & advertising": "agency",
  "retail": "ecommerce",
  "e-commerce": "ecommerce",
  "information technology & services": "saas",
  "real estate": "realestate",
  "legal services": "legal",
};

function normalizeVertical(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (VALID_VERTICALS.has(lower)) return lower;
  return VERTICAL_MAP[lower] ?? "other";
}

function normalizeWebsite(raw: string): string {
  if (!raw) return "";
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function inferSourceFromFilename(filename: string): string {
  const name = filename.toLowerCase().replace(".csv", "");
  if (name.includes("apollo")) return "apollo";
  if (name.includes("clutch")) return "clutch";
  if (name.includes("upcity")) return "upcity";
  if (name.includes("chamber")) return "chamber";
  if (name.includes("outscraper")) return "outscraper";
  if (name.includes("yellowpages")) return "yellowpages";
  return name.split("-")[0] ?? "unknown";
}

// ─── Deduplication helper ─────────────────────────────────────────────────────

function dedupByEmail(rows: { email: string }[]): typeof rows {
  const seen = new Set<string>();
  return rows.filter(r => {
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
}

// ─── Suppression helper ───────────────────────────────────────────────────────

function applySuppression(
  leads: { email: string }[],
  suppressed: Set<string>
): typeof leads {
  return leads.filter(l => !suppressed.has(l.email.toLowerCase()));
}

// ─── Filter verified helper ───────────────────────────────────────────────────

const REMOVE_STATUSES = new Set(["invalid", "disposable", "spam_trap"]);

function filterVerified(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter(r => {
    const status = (r["result"] ?? r["nb_result"] ?? r["verified"] ?? "").toLowerCase().trim();
    return !REMOVE_STATUSES.has(status);
  }).map(r => {
    const status = (r["result"] ?? r["nb_result"] ?? r["verified"] ?? "").toLowerCase().trim();
    return { ...r, verified: status === "catch-all" ? "catch-all" : status === "valid" ? "valid" : status || "unknown" };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("CSV parser", () => {
  it("parses simple CSV", () => {
    const csv = "name,email\nAcme,hello@acme.com\nBeta,info@beta.io";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: "Acme", email: "hello@acme.com" });
  });

  it("handles quoted fields with commas", () => {
    const csv = `company,email\n"Acme, Inc.",hello@acme.com`;
    const rows = parseCSV(csv);
    expect(rows[0]["company"]).toBe("Acme, Inc.");
  });

  it("handles escaped double quotes", () => {
    const line = `"She said ""hello""",test@test.com`;
    const parts = parseCSVLine(line);
    expect(parts[0]).toBe('She said "hello"');
  });

  it("returns empty for CSV with only a header", () => {
    expect(parseCSV("name,email")).toHaveLength(0);
  });

  it("skips blank lines", () => {
    const csv = "name,email\nAcme,a@a.com\n\nBeta,b@b.com";
    expect(parseCSV(csv)).toHaveLength(2);
  });
});

describe("normalizeVertical", () => {
  it("passes through valid verticals unchanged", () => {
    expect(normalizeVertical("agency")).toBe("agency");
    expect(normalizeVertical("ecommerce")).toBe("ecommerce");
    expect(normalizeVertical("saas")).toBe("saas");
  });

  it("maps Apollo industry labels to verticals", () => {
    expect(normalizeVertical("Marketing & Advertising")).toBe("agency");
    expect(normalizeVertical("Retail")).toBe("ecommerce");
    expect(normalizeVertical("E-Commerce")).toBe("ecommerce");
    expect(normalizeVertical("Information Technology & Services")).toBe("saas");
    expect(normalizeVertical("Real Estate")).toBe("realestate");
    expect(normalizeVertical("Legal Services")).toBe("legal");
  });

  it("falls back to 'other' for unknown industry", () => {
    expect(normalizeVertical("Underwater Basket Weaving")).toBe("other");
    expect(normalizeVertical("")).toBe("other");
  });
});

describe("normalizeWebsite", () => {
  it("adds https:// when missing", () => {
    expect(normalizeWebsite("acme.com")).toBe("https://acme.com");
  });

  it("strips path from URL", () => {
    expect(normalizeWebsite("https://acme.com/about/team")).toBe("https://acme.com");
  });

  it("preserves existing protocol", () => {
    expect(normalizeWebsite("http://old.com/page")).toBe("http://old.com");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeWebsite("")).toBe("");
  });
});

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("hello@acme.com")).toBe(true);
    expect(isValidEmail("info+tag@sub.domain.co")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("@nodomain")).toBe(false);
    expect(isValidEmail("noatsign.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("inferSourceFromFilename", () => {
  it("infers source from common filenames", () => {
    expect(inferSourceFromFilename("apollo-agencies.csv")).toBe("apollo");
    expect(inferSourceFromFilename("clutch-scrape.csv")).toBe("clutch");
    expect(inferSourceFromFilename("upcity-agencies.csv")).toBe("upcity");
    expect(inferSourceFromFilename("chamber-nyc.csv")).toBe("chamber");
    expect(inferSourceFromFilename("outscraper-realestate.csv")).toBe("outscraper");
    expect(inferSourceFromFilename("yellowpages-results.csv")).toBe("yellowpages");
  });
});

describe("deduplication", () => {
  it("removes duplicate emails (keeps first)", () => {
    const rows = [
      { email: "a@a.com", company_name: "First" },
      { email: "b@b.com", company_name: "Second" },
      { email: "a@a.com", company_name: "Duplicate" },
    ];
    const result = dedupByEmail(rows);
    expect(result).toHaveLength(2);
    expect(result[0].company_name).toBe("First");
  });

  it("handles empty array", () => {
    expect(dedupByEmail([])).toHaveLength(0);
  });

  it("handles no duplicates", () => {
    const rows = [{ email: "a@a.com" }, { email: "b@b.com" }];
    expect(dedupByEmail(rows)).toHaveLength(2);
  });
});

describe("suppression", () => {
  it("removes suppressed emails", () => {
    const leads = [
      { email: "keep@a.com" },
      { email: "remove@b.com" },
      { email: "also-keep@c.com" },
    ];
    const suppressed = new Set(["remove@b.com"]);
    const result = applySuppression(leads, suppressed);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.email)).not.toContain("remove@b.com");
  });

  it("is case-insensitive on lead emails", () => {
    const leads = [{ email: "REMOVE@B.COM" }];
    const suppressed = new Set(["remove@b.com"]);
    // The lead email is already lowercased in suppress.ts before lookup
    // Test the expected behavior: suppression list has lowercase, lead may not
    const normalized = leads.map(l => ({ email: l.email.toLowerCase() }));
    expect(applySuppression(normalized, suppressed)).toHaveLength(0);
  });

  it("returns all leads when suppression list is empty", () => {
    const leads = [{ email: "a@a.com" }, { email: "b@b.com" }];
    expect(applySuppression(leads, new Set())).toHaveLength(2);
  });
});

describe("filterVerified", () => {
  it("removes invalid and disposable records", () => {
    const rows = [
      { email: "a@a.com", result: "valid" },
      { email: "b@b.com", result: "invalid" },
      { email: "c@c.com", result: "disposable" },
      { email: "d@d.com", result: "catch-all" },
    ];
    const result = filterVerified(rows);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.email)).toEqual(["a@a.com", "d@d.com"]);
  });

  it("sets verified=valid for valid records", () => {
    const rows = [{ email: "a@a.com", result: "valid" }];
    expect(filterVerified(rows)[0].verified).toBe("valid");
  });

  it("sets verified=catch-all for catch-all records", () => {
    const rows = [{ email: "a@a.com", result: "catch-all" }];
    expect(filterVerified(rows)[0].verified).toBe("catch-all");
  });

  it("handles empty input", () => {
    expect(filterVerified([])).toHaveLength(0);
  });
});

describe("lead schema validation", () => {
  const REQUIRED_COLS = ["company_name", "website", "email", "vertical", "city", "state", "source", "verified"];

  it("standard CSV header contains all required columns", () => {
    const header = "company_name,website,email,vertical,city,state,source,verified";
    const cols = header.split(",").map(c => c.trim().toLowerCase());
    for (const required of REQUIRED_COLS) {
      expect(cols).toContain(required);
    }
  });

  it("suppression CSV header is correct", () => {
    const header = "email,reason,date_added";
    const cols = header.split(",");
    expect(cols).toContain("email");
    expect(cols).toContain("reason");
    expect(cols).toContain("date_added");
  });
});
