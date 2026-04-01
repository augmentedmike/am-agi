# SOP: US Small Business Lead Database

**Owner:** Am (Amelia)
**Last updated:** 2026-03-31
**Purpose:** Build and maintain a database of US small businesses with public email addresses, segmented by vertical, for Am outreach.

---

## 1. Output Schema

Final CSV: `leads/leads.csv`

| Column | Description | Example |
|---|---|---|
| `company_name` | Business legal or trade name | Acme Web Design |
| `website` | Root domain | https://acmewebdesign.com |
| `email` | Public email from website or directory | hello@acmewebdesign.com |
| `vertical` | One of: `agency`, `ecommerce`, `saas`, `realestate`, `legal`, `other` | agency |
| `city` | City of business | Austin |
| `state` | 2-letter US state code | TX |
| `source` | Where the record came from | apollo, clutch, yellowpages, chamber, upcity, outscraper |
| `verified` | NeverBounce result: `valid`, `invalid`, `catch-all`, `unknown` | valid |

Suppression list: `leads/suppression.csv` (receives opt-outs; always check before sending)

---

## 2. Lead Sources & Collection Steps

### Source 1: Apollo.io (Primary — agencies, e-commerce, SaaS)

**Setup:**
1. Sign up at https://www.apollo.io/sign-up (free)
2. Upgrade to Basic ($49/mo) for headcount filter 1–50 and bulk export

**Filters to run (save each as a separate CSV in `leads/raw/`):**

| Filename | Filters |
|---|---|
| `raw/apollo-agencies.csv` | Industry = "Marketing & Advertising" + Employees 1–50 + Country = US |
| `raw/apollo-ecommerce.csv` | Industry = "Retail" OR "E-Commerce" + Employees 1–50 + Country = US |
| `raw/apollo-saas.csv` | Industry = "Information Technology & Services" + Employees 1–20 + Country = US |
| `raw/apollo-realestate.csv` | Industry = "Real Estate" + Employees 1–50 + Country = US |
| `raw/apollo-legal.csv` | Industry = "Legal Services" + Employees 1–50 + Country = US |

**Export:** People → Saved Search → Export CSV → select columns: First Name, Last Name, Email, Company, Company Website, City, State, Industry.

**After export:** run `bun run leads/scripts/merge.ts` to normalize and merge into `leads.csv`.

---

### Source 2: Clutch.co (Agencies)

**URL:** https://clutch.co/agencies/digital-marketing?country_codes[]=US&min_employees=1&max_employees=50

1. Install Instant Data Scraper (Chrome extension) — free
2. Navigate to each page of Clutch results
3. Scrape: company name, website URL
4. Save to `leads/raw/clutch-agencies.csv` (columns: company_name, website)
5. For email discovery: run Hunter.io Domain Search against each website (free: 25/mo, paid: 500+/mo)
   - Or use Hunter.io bulk upload at https://hunter.io/bulk
6. Save enriched output to `leads/raw/clutch-agencies-enriched.csv`

---

### Source 3: Yellow Pages / Outscraper (Real Estate & Legal)

**Outscraper (Google Maps):** https://outscraper.com
- Free: 500 records/month
- PAYG: ~$3–5 per 1,000

**Queries to run:**

| Search Query | Location | Output File |
|---|---|---|
| "real estate agency" | United States | `raw/outscraper-realestate.csv` |
| "real estate broker" | United States | `raw/outscraper-realestate-broker.csv` |
| "law firm" | United States | `raw/outscraper-legal.csv` |
| "digital marketing agency" | United States | `raw/outscraper-agencies.csv` |

**Fields to export:** name, website, phone, full_address, city, state, email (when available)

Note: Outscraper sometimes returns emails directly from Google Business Profile. When not available, enrich with Hunter.io.

---

### Source 4: UpCity Directory (Agencies)

**URL:** https://upcity.com/local-marketing-agencies/

1. Navigate each city/state listing page
2. Use Instant Data Scraper to extract: agency name, website URL
3. Save to `leads/raw/upcity-agencies.csv`
4. Enrich emails via Hunter.io bulk domain search
5. Save enriched to `leads/raw/upcity-agencies-enriched.csv`

---

### Source 5: Chamber of Commerce Directories

**National directory:** https://uschamberdirectory.com/

1. Pick 5 major metro chambers (e.g., NYC, LA, Chicago, Houston, Phoenix)
2. Navigate to their member directory pages
3. Extract: company name, website, email (when listed publicly)
4. Save to `leads/raw/chamber-[cityname].csv`

**Apify scraper (optional, automates this):**
https://apify.com/powerai/chamberofcommerce-business-scraper
Free tier: 100 records/month

---

### Source 6: Hunter.io Domain Enrichment (Email Discovery Layer)

Use Hunter.io to find emails for any record that has a website but no email:

1. Go to https://hunter.io/bulk
2. Upload a CSV with a `domain` column
3. Download enriched CSV with email patterns
4. Map back to `leads/raw/` source file

---

## 3. Data Cleaning & Merge

Run the merge script to combine all raw sources:

```sh
bun run leads/scripts/merge.ts
```

This script:
1. Reads all CSVs from `leads/raw/`
2. Normalizes column names to the standard schema
3. Deduplicates by email address (keeps first occurrence)
4. Validates US state codes
5. Outputs merged file to `leads/leads-unverified.csv`

---

## 4. Email Verification

**Tool:** NeverBounce — https://neverbounce.com
**Pricing:** 1,000 one-time free trial; PAYG $8/1,000 after

**Steps:**
1. Upload `leads/leads-unverified.csv` to NeverBounce bulk verify
2. Download results (adds a `result` column with: valid, invalid, catch-all, unknown, disposable)
3. Save to `leads/leads-verified-raw.csv`
4. Run the filter script:

```sh
bun run leads/scripts/filter-verified.ts
```

This removes `invalid` and `disposable` records, flags `catch-all` as unverified, keeps `valid`.

---

## 5. Final Output

```sh
bun run leads/scripts/finalize.ts
```

Produces `leads/leads.csv` with standard columns and only verified/catch-all records.

---

## 6. Suppression List Management

- File: `leads/suppression.csv`
- Add unsubscribes immediately when received
- Before any send, run:

```sh
bun run leads/scripts/suppress.ts --input leads/leads.csv --suppress leads/suppression.csv --output leads/leads-sendable.csv
```

---

## 7. Adding More Leads

Repeat the collection steps above for any new source. Drop the raw CSV in `leads/raw/` and re-run the merge + verify pipeline. The merge script is idempotent — duplicates are removed automatically.

---

## 8. Tools Summary

| Tool | URL | Cost | Role |
|---|---|---|---|
| Apollo.io | apollo.io | Free / $49/mo | Primary B2B database |
| Hunter.io | hunter.io | Free (25/mo) / $49/mo | Email discovery by domain |
| NeverBounce | neverbounce.com | $8/1,000 PAYG | Email verification |
| Instant Data Scraper | Chrome extension | Free | Scrape Clutch/UpCity/Chamber |
| Outscraper | outscraper.com | Free 500/mo / PAYG | Google Maps scrape |
| Apify | apify.com | Free tier | Chamber scraping |

**Total cost to 1,000 verified leads: under $50**
