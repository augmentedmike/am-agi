/**
 * Application Tracker — appends records to applications.json on each run.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { ParsedJD } from "./jd-parser.ts";
import type { ScoringResult } from "./scorer.ts";

export interface ApplicationRecord {
  id: string;
  date: string;
  company: string;
  role: string;
  jd_snippet: string;
  output_file: string;
  baseline_score: number;
  tailored_score: number;
  score_improvement_pct: number;
  status: "applied" | "pending" | "rejected" | "interview" | "offer";
  notes: string;
}

const TRACKER_PATH = join(
  import.meta.dir,
  "..",
  "applications.json"
);

function loadApplications(): ApplicationRecord[] {
  if (!existsSync(TRACKER_PATH)) return [];
  try {
    return JSON.parse(readFileSync(TRACKER_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveApplications(records: ApplicationRecord[]): void {
  writeFileSync(TRACKER_PATH, JSON.stringify(records, null, 2), "utf-8");
}

function generateId(): string {
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function trackApplication(
  jd: ParsedJD,
  outputFile: string,
  baselineScore: number,
  tailoredScore: number
): ApplicationRecord {
  const records = loadApplications();

  const improvement =
    baselineScore > 0
      ? ((tailoredScore - baselineScore) / baselineScore) * 100
      : tailoredScore * 100;

  const record: ApplicationRecord = {
    id: generateId(),
    date: new Date().toISOString(),
    company: jd.company,
    role: jd.role,
    jd_snippet: jd.raw_snippet,
    output_file: outputFile,
    baseline_score: Math.round(baselineScore * 1000) / 1000,
    tailored_score: Math.round(tailoredScore * 1000) / 1000,
    score_improvement_pct: Math.round(improvement * 10) / 10,
    status: "pending",
    notes: "",
  };

  records.push(record);
  saveApplications(records);

  return record;
}

export function listApplications(): ApplicationRecord[] {
  return loadApplications();
}

export function updateApplicationStatus(
  id: string,
  status: ApplicationRecord["status"],
  notes?: string
): void {
  const records = loadApplications();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Application ${id} not found`);
  records[idx].status = status;
  if (notes) records[idx].notes = notes;
  saveApplications(records);
}
