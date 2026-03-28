# Job Search Pipeline

Automated resume customization system for Michael O'Neal.

## Overview

Feed a job description → get a tailored resume (Markdown + PDF) + application log entry, quality-gated to ensure the tailored version scores ≥20% better than the baseline.

## Quick Start

```sh
# Set API key (required)
export ANTHROPIC_API_KEY="$(vault get anthropic-api-key)"

# Tailor to a job posting
resume-tailor --jd /path/to/job-description.txt

# Read JD from stdin
pbpaste | resume-tailor --jd -

# Custom output directory + verbose mode
resume-tailor --jd jd.txt --output ~/Desktop --verbose
```

Output lands in `workspaces/job-search/output/` by default.

## File Layout

```
workspaces/job-search/
  master-resume.json       # Source of truth — all experience, bullets, skills
  applications.json        # Running application log (appended on each run)
  output/                  # Generated resumes
    michael-oneal-<role>-<company>-<YYYYMMDD>.md
    michael-oneal-<role>-<company>-<YYYYMMDD>.pdf
    michael-oneal-<role>-<company>-<YYYYMMDD>-jd.json
  lib/
    jd-parser.ts           # Claude-powered JD structured extraction
    scorer.ts              # Keyword overlap relevance scorer
    rewriter.ts            # Claude-powered resume rewriter
    renderer.ts            # Markdown + PDF renderer (Pandoc)
    tracker.ts             # Application record appender
    pipeline.ts            # Orchestrates all stages end-to-end
bin/
  resume-tailor            # CLI entry point
```

## Pipeline Stages

1. **JD Parsing** — Claude extracts: role, company, must-haves, nice-to-haves, keywords, tone, culture signals → `<filename>-jd.json`

2. **Relevance Scoring** — keyword overlap scores every bullet in `master-resume.json`; top-N selected (default 12)

3. **LLM Rewrite** — Claude rewrites summary + selected bullets to mirror JD language, with strict rules:
   - No new skills, companies, or accomplishments
   - All metrics preserved exactly
   - No keyword stuffing

4. **Hallucination Guard** — output verified against master-resume.json; violations printed as warnings

5. **Rendering** — Markdown written, then PDF via Pandoc (`xelatex` → `pdflatex` → `wkhtmltopdf` fallback chain)

6. **Quality Gate** — tailored resume's keyword score vs JD must be ≥20% above baseline; non-zero exit if not

7. **Application Tracking** — record appended to `applications.json`: company, role, scores, file path, date

## Installing PDF Support

```sh
brew install pandoc mactex
# Wait for mactex (~4GB) then rehash
hash -r
```

Without pandoc/LaTeX, the pipeline still produces `.md` output and logs a warning.

## Adding a New Job Posting

1. Copy the job description text to a `.txt` file (or pipe it from clipboard)
2. Run `resume-tailor --jd your-jd.txt`
3. Review the output `.md` in `workspaces/job-search/output/`
4. If quality gate passes, send the `.pdf`

## Editing the Master Resume

Edit `workspaces/job-search/master-resume.json` directly. Schema:

```json
{
  "meta": { "name", "location", "relocation", "target_salary", "github", "sites" },
  "summary": { "headline", "body", "tagline" },
  "experience": [
    {
      "id": "unique-id",
      "title": "Job Title",
      "company": "Company",
      "start": "YYYY",
      "end": "YYYY or Present",
      "bullets": [
        { "id": "exp-1", "text": "...", "keywords": ["k1", "k2"], "metrics": {} }
      ]
    }
  ],
  "skills": { "programming_languages": [], "ml_ai": [], "systems": [], "frameworks_tools": [] },
  "companies_worked_with": ["..."],
  "education": [{ "degree", "institution", "year", "notes" }]
}
```

The more keywords you tag on each bullet, the better the scorer performs.

## Application Log

`applications.json` stores every run:

```json
[
  {
    "id": "app-...",
    "date": "2026-03-28T...",
    "company": "Acme Corp",
    "role": "Staff AI Engineer",
    "jd_snippet": "first 500 chars of JD",
    "output_file": "/path/to/resume.pdf",
    "baseline_score": 0.087,
    "tailored_score": 0.24,
    "score_improvement_pct": 175.9,
    "status": "pending",
    "notes": ""
  }
]
```

Update status manually as applications progress: `pending` → `applied` → `interview` → `offer` / `rejected`.

## CLI Reference

```
resume-tailor --jd <path>          Tailor resume to job description file
resume-tailor --jd -               Read JD from stdin

Options:
  --jd <path>        Path to JD text file (or "-" for stdin)
  --output <dir>     Output directory (default: workspaces/job-search/output/)
  --top <n>          Bullets to select (default: 12)
  --verbose, -v      Show detailed progress + bullet scores
  --help, -h         This help
```

## Requirements

- `ANTHROPIC_API_KEY` environment variable
- `bun` runtime
- `pandoc` + LaTeX for PDF (optional — falls back to MD-only)
