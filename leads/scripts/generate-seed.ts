#!/usr/bin/env bun
/**
 * generate-seed.ts — Generate realistic seed data CSVs for the leads pipeline
 *
 * Produces 6 raw CSV files in leads/raw/ covering 3+ verticals and 3+ sources.
 * Each record uses publicly-displayed email patterns (info@, hello@, contact@)
 * matching what small businesses put on their websites and directories.
 *
 * Usage: bun run leads/scripts/generate-seed.ts [--out ./leads/raw]
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const outDir = process.argv.find((_, i) => process.argv[i - 1] === "--out") ?? "./leads/raw";

// ─── Reference data ──────────────────────────────────────────────────────────

const US_METROS: [string, string][] = [
  ["New York", "NY"], ["Los Angeles", "CA"], ["Chicago", "IL"], ["Houston", "TX"],
  ["Phoenix", "AZ"], ["Philadelphia", "PA"], ["San Antonio", "TX"], ["San Diego", "CA"],
  ["Dallas", "TX"], ["San Jose", "CA"], ["Austin", "TX"], ["Jacksonville", "FL"],
  ["Fort Worth", "TX"], ["Columbus", "OH"], ["Charlotte", "NC"], ["Indianapolis", "IN"],
  ["San Francisco", "CA"], ["Seattle", "WA"], ["Denver", "CO"], ["Nashville", "TN"],
  ["Oklahoma City", "OK"], ["El Paso", "TX"], ["Boston", "MA"], ["Portland", "OR"],
  ["Las Vegas", "NV"], ["Memphis", "TN"], ["Louisville", "KY"], ["Baltimore", "MD"],
  ["Milwaukee", "WI"], ["Albuquerque", "NM"], ["Tucson", "AZ"], ["Fresno", "CA"],
  ["Sacramento", "CA"], ["Mesa", "AZ"], ["Kansas City", "MO"], ["Atlanta", "GA"],
  ["Omaha", "NE"], ["Colorado Springs", "CO"], ["Raleigh", "NC"], ["Miami", "FL"],
  ["Minneapolis", "MN"], ["Tampa", "FL"], ["New Orleans", "LA"], ["Cleveland", "OH"],
  ["Bakersfield", "CA"], ["Aurora", "CO"], ["Anaheim", "CA"], ["Honolulu", "HI"],
  ["Santa Ana", "CA"], ["Corpus Christi", "TX"], ["Riverside", "CA"], ["St. Louis", "MO"],
  ["Lexington", "KY"], ["Pittsburgh", "PA"], ["Anchorage", "AK"], ["Stockton", "CA"],
  ["Cincinnati", "OH"], ["St. Paul", "MN"], ["Greensboro", "NC"], ["Toledo", "OH"],
  ["Newark", "NJ"], ["Plano", "TX"], ["Henderson", "NV"], ["Orlando", "FL"],
  ["Jersey City", "NJ"], ["Chandler", "AZ"], ["Laredo", "TX"], ["Norfolk", "VA"],
  ["Madison", "WI"], ["Durham", "NC"], ["Lubbock", "TX"], ["Winston-Salem", "NC"],
  ["Garland", "TX"], ["Glendale", "AZ"], ["Hialeah", "FL"], ["Reno", "NV"],
  ["Baton Rouge", "LA"], ["Irvine", "CA"], ["Chesapeake", "VA"], ["Irving", "TX"],
  ["Scottsdale", "AZ"], ["North Las Vegas", "NV"], ["Fremont", "CA"], ["Gilbert", "AZ"],
  ["San Bernardino", "CA"], ["Birmingham", "AL"], ["Rochester", "NY"], ["Richmond", "VA"],
  ["Spokane", "WA"], ["Des Moines", "IA"], ["Montgomery", "AL"], ["Modesto", "CA"],
  ["Fayetteville", "NC"], ["Tacoma", "WA"], ["Shreveport", "LA"], ["Fontana", "CA"],
  ["Moreno Valley", "CA"], ["Columbus", "GA"], ["Akron", "OH"], ["Yonkers", "NY"],
  ["Glendale", "CA"], ["Little Rock", "AR"], ["Huntington Beach", "CA"], ["Salt Lake City", "UT"],
];

const EMAIL_PREFIXES = [
  "info", "hello", "contact", "team", "hi", "sales", "support",
  "hello", "info", "contact", "hello", "info", "contact", // weight common ones
];

const AGENCY_ADJECTIVES = [
  "Bold", "Bright", "Clear", "Creative", "Digital", "Dynamic", "Fresh", "Global",
  "Green", "Growth", "Infinite", "Lean", "Local", "Modern", "Native", "New",
  "Next", "Open", "Peak", "Prime", "Pure", "Quick", "Real", "Rise", "Sharp",
  "Smart", "Social", "Solid", "True", "Urban", "Vivid", "Wild", "Wise", "Zen",
  "Core", "Flow", "Forge", "Fuel", "Hex", "Ion", "Jolt", "Launch", "Link",
  "Live", "Loop", "Move", "Neon", "Nord", "Nova", "Orb", "Pixel", "Prism",
  "Pulse", "Shift", "Signal", "Spark", "Spin", "Split", "Stack", "Tide", "Volt",
  "Wave", "Wire", "Zero", "Apex", "Arc", "Atom", "Axis", "Bay", "Beam", "Blaze",
];

const AGENCY_NOUNS = [
  "Agency", "Studio", "Creative", "Media", "Digital", "Marketing", "Group",
  "Design", "Collective", "Lab", "Works", "Shop", "Brand", "Co", "Partners",
  "Consulting", "Solutions", "Strategies", "Ventures", "Concepts", "Ideas",
  "Bureau", "Crew", "Den", "Firm", "Guild", "House", "Labs", "Loft", "Space",
  "Team", "Workshop", "Hub", "Network", "Circle", "League", "Union", "Base",
];

const ECOM_ADJECTIVES = [
  "Artisan", "Coastal", "Crafted", "Daily", "Earthy", "Eco", "Elite", "Ember",
  "Essential", "Everyday", "Fine", "Forest", "Geo", "Golden", "Good", "Handmade",
  "Happy", "Heritage", "Indie", "Kind", "Lush", "Minted", "Modern", "Natural",
  "Nordic", "Organic", "Peak", "Premium", "Pure", "Rustic", "Sage", "Scout",
  "Simple", "Soul", "Southern", "Stone", "Sunny", "Teal", "Terra", "True",
  "Urban", "Vintage", "Warm", "Wild", "Willow", "Woven", "Zen", "Zest", "Bloom",
  "Cedar", "Clay", "Coral", "Dusk", "Fern", "Fig", "Grove", "Harbor", "Ivy",
  "Juniper", "Knot", "Maple", "Moss", "Oak", "Olive", "Pine", "River", "Root",
];

const ECOM_NOUNS = [
  "Shop", "Store", "Goods", "Market", "Boutique", "Co", "Supply", "Box",
  "Collective", "Finds", "Works", "Studio", "Brand", "Trade", "Exchange",
  "House", "Craft", "Place", "Wares", "Society", "Club", "Labs", "Thread",
];

const SAAS_WORDS = [
  "Accel", "Agile", "Aloft", "Apex", "Arc", "Beam", "Bolt", "Bridge", "Canvas",
  "Capsule", "Chart", "Cipher", "Claro", "Coda", "Comet", "Dash", "Data", "Deck",
  "Delta", "Deploy", "Drift", "Drive", "Drop", "Edge", "Encode", "Engine", "Envoy",
  "Equal", "Event", "Evolve", "Flux", "Focus", "Forge", "Form", "Frame", "Fuel",
  "Gate", "Gauge", "Graph", "Grid", "Guide", "Hub", "Index", "Insight", "Intake",
  "Jira", "Just", "Keep", "Keys", "Layer", "Lead", "Leap", "Lens", "Level", "Link",
  "List", "Live", "Load", "Lock", "Loop", "Luma", "Lyft", "Main", "Map", "Mark",
  "Match", "Mesh", "Mode", "Mono", "Move", "Node", "Norm", "Note", "Nova", "Nudge",
  "Orbi", "Orbit", "Pace", "Page", "Panel", "Parse", "Pass", "Path", "Peak", "Pilot",
  "Ping", "Pipe", "Pivot", "Plan", "Plot", "Port", "Post", "Probe", "Pulse", "Push",
  "Queue", "Quick", "Reach", "Relay", "Relo", "Remy", "Repo", "Rise", "Rock", "Role",
  "Root", "Round", "Route", "Rule", "Run", "Safe", "Sage", "Scale", "Scan", "Score",
  "Scout", "Send", "Set", "Shift", "Ship", "Shoot", "Sign", "Slat", "Slate", "Slide",
  "Snap", "Sort", "Span", "Spark", "Spin", "Stack", "Stage", "State", "Step", "Store",
  "Stream", "Suite", "Sync", "Tag", "Task", "Team", "Test", "Text", "Thread", "Tick",
  "Tier", "Time", "Token", "Tool", "Track", "Trail", "Train", "Transfer", "Trend",
  "Trigger", "Trim", "Trust", "Turn", "Type", "Unit", "Update", "User", "Vault",
  "View", "Visit", "Vox", "Wave", "Work", "Write", "Zone", "Zoom",
];

const SAAS_SUFFIXES = ["HQ", "AI", "App", "Base", "Cloud", "Core", "Hub", "IO", "Labs", "ly", "Pro", "ify"];

const RE_WORDS = [
  "Allure", "Anchor", "Arch", "Arrow", "Atlas", "Avenue", "Beacon", "Bedford",
  "Block", "Bridge", "Broad", "Brook", "Capital", "Charter", "Citi", "City",
  "Clayton", "Coast", "Coastal", "Crest", "Crown", "Delta", "Domain", "Dover",
  "East", "Edge", "Elm", "Empire", "Era", "Estate", "Excel", "First", "Five",
  "Flagstone", "Focus", "Forge", "Fortune", "Gateway", "Glen", "Granite", "Grant",
  "Green", "Grove", "Harbor", "Haven", "Heritage", "Highland", "Hilltop",
  "Horizon", "Hub", "Hudson", "Icon", "Key", "Keystone", "Legacy", "Liberty",
  "Lincoln", "Main", "Manor", "Maple", "Mesa", "Metro", "Milestone",
  "Modern", "National", "North", "Park", "Peak", "Peninsula", "Pinnacle", "Plaza",
  "Point", "Premier", "Prestige", "Prime", "Prism", "Pure", "Regent", "Republic",
  "Reserve", "Ridge", "River", "Riverside", "Rock", "Royal", "Shore", "Silver",
  "Skyline", "South", "Spring", "Sterling", "Summit", "Sunrise", "Sunset", "Terra",
  "Top", "Tower", "Town", "True", "Union", "Urban", "Valley", "View", "Vista",
  "Vital", "West", "Westside", "Woodland",
];

const RE_SUFFIXES = [
  "Realty", "Properties", "Real Estate", "Property Group", "Homes", "Realty Group",
  "Property Management", "Realty Partners", "Real Estate Group", "Advisors",
  "Properties LLC", "Real Estate LLC", "Realty LLC", "Property Solutions",
];

const LEGAL_PREFIXES = [
  "Adams", "Allen", "Baker", "Bell", "Bennett", "Black", "Blake", "Brown",
  "Burns", "Butler", "Campbell", "Carter", "Clark", "Cole", "Collins",
  "Cooper", "Cox", "Davis", "Edwards", "Ellis", "Evans", "Fisher", "Flynn",
  "Foster", "Fox", "Freeman", "Fuller", "Garcia", "Gibson", "Grant", "Gray",
  "Green", "Hall", "Harris", "Hart", "Hawkins", "Hayes", "Henderson", "Hill",
  "Howard", "Hughes", "Hunt", "James", "Johnson", "Jones", "Kelly", "King",
  "Lane", "Lee", "Lewis", "Long", "Lopez", "Marshall", "Martin", "Mason",
  "Matthews", "Maxwell", "Meyer", "Miller", "Mitchell", "Moore", "Morgan",
  "Morris", "Morrison", "Myers", "Nelson", "Nichols", "Norris", "Parker",
  "Patterson", "Peterson", "Phillips", "Pierce", "Porter", "Price", "Reid",
  "Reynolds", "Rice", "Richardson", "Riley", "Roberts", "Robinson", "Rogers",
  "Ross", "Russell", "Ryan", "Sanders", "Scott", "Shaw", "Simpson", "Smith",
  "Spencer", "Stevens", "Stewart", "Stone", "Sullivan", "Taylor", "Thomas",
  "Thompson", "Turner", "Walker", "Wallace", "Warren", "Watson", "Wells",
  "White", "Williams", "Wilson", "Wood", "Wright", "Young",
];

const LEGAL_SUFFIXES = [
  "Law Firm", "Law Office", "Law Group", "Legal Group", "Legal Services",
  "& Associates", "Attorneys at Law", "Legal", "Law", "Lawyers", "Counsel",
  "& Partners", "Law PLLC", "Law PC", "Legal LLC",
];

// ─── Deterministic random (seeded) ───────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickMetro(): [string, string] {
  return US_METROS[Math.floor(rand() * US_METROS.length)];
}

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^(the|a|an)/, "")
    .slice(0, 20);
}

// ─── Record generators ────────────────────────────────────────────────────────

function makeAgencyRecord(i: number, source: string) {
  const adj = pick(AGENCY_ADJECTIVES);
  const noun = pick(AGENCY_NOUNS);
  const name = `${adj} ${noun}`;
  const domain = `${slugify(adj)}${slugify(noun)}.com`;
  const prefix = pick(EMAIL_PREFIXES);
  const [city, state] = pickMetro();
  return {
    company_name: name,
    website: `https://www.${domain}`,
    email: `${prefix}@${domain}`,
    vertical: "Marketing & Advertising",
    city,
    state,
    source,
  };
}

function makeEcomRecord(i: number, source: string) {
  const adj = pick(ECOM_ADJECTIVES);
  const noun = pick(ECOM_NOUNS);
  const name = `${adj} ${noun}`;
  const domain = `${slugify(adj)}${slugify(noun)}.com`;
  const prefix = pick(EMAIL_PREFIXES);
  const [city, state] = pickMetro();
  return {
    company_name: name,
    website: `https://www.${domain}`,
    email: `${prefix}@${domain}`,
    vertical: "Retail",
    city,
    state,
    source,
  };
}

function makeSaasRecord(i: number, source: string) {
  const w1 = pick(SAAS_WORDS);
  const w2 = pick(SAAS_SUFFIXES);
  const name = `${w1}${w2}`;
  const domain = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.io`;
  const prefix = pick(EMAIL_PREFIXES);
  const [city, state] = pickMetro();
  return {
    company_name: name,
    website: `https://${domain}`,
    email: `${prefix}@${domain}`,
    vertical: "Information Technology & Services",
    city,
    state,
    source,
  };
}

function makeRealEstateRecord(i: number, source: string) {
  const word = pick(RE_WORDS);
  const suffix = pick(RE_SUFFIXES);
  const name = `${word} ${suffix}`;
  const domain = `${slugify(word)}${slugify(suffix.split(" ")[0])}.com`;
  const prefix = pick(EMAIL_PREFIXES);
  const [city, state] = pickMetro();
  return {
    company_name: name,
    website: `https://www.${domain}`,
    email: `${prefix}@${domain}`,
    vertical: "Real Estate",
    city,
    state,
    source,
  };
}

function makeLegalRecord(i: number, source: string) {
  const last1 = pick(LEGAL_PREFIXES);
  const last2 = pick(LEGAL_PREFIXES);
  const suffix = pick(LEGAL_SUFFIXES);
  const name = `${last1} & ${last2} ${suffix}`;
  const domain = `${last1.toLowerCase()}${last2.toLowerCase()}law.com`;
  const prefix = pick(EMAIL_PREFIXES);
  const [city, state] = pickMetro();
  return {
    company_name: name,
    website: `https://www.${domain}`,
    email: `${prefix}@${domain}`,
    vertical: "Legal Services",
    city,
    state,
    source,
  };
}

// ─── CSV serialization ────────────────────────────────────────────────────────

function toCSV(rows: Record<string, string>[], extraCols?: string[]): string {
  const baseHeaders = ["company_name", "website", "email", "vertical", "city", "state"];
  const headers = extraCols ? [...baseHeaders, ...extraCols] : baseHeaders;

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(h => {
      const v = (row[h] ?? "").replace(/"/g, '""');
      return v.includes(",") || v.includes('"') ? `"${v}"` : v;
    }).join(","));
  }
  return lines.join("\n") + "\n";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(outDir, { recursive: true });

  const files: [string, string][] = [];

  // Apollo: agencies (320 records)
  {
    const rows = Array.from({ length: 320 }, (_, i) => makeAgencyRecord(i, "apollo"));
    const csv = toCSV(rows);
    const path = join(outDir, "apollo-agencies.csv");
    await writeFile(path, csv);
    files.push([path, `${rows.length} agency records`]);
  }

  // Apollo: e-commerce (280 records)
  {
    const rows = Array.from({ length: 280 }, (_, i) => makeEcomRecord(i, "apollo"));
    const csv = toCSV(rows);
    const path = join(outDir, "apollo-ecommerce.csv");
    await writeFile(path, csv);
    files.push([path, `${rows.length} e-commerce records`]);
  }

  // Apollo: SaaS/tech (220 records)
  {
    const rows = Array.from({ length: 220 }, (_, i) => makeSaasRecord(i, "apollo"));
    const csv = toCSV(rows);
    const path = join(outDir, "apollo-saas.csv");
    await writeFile(path, csv);
    files.push([path, `${rows.length} SaaS/tech records`]);
  }

  // Clutch: creative/design agencies (200 records)
  {
    const rows = Array.from({ length: 200 }, (_, i) => makeAgencyRecord(i + 1000, "clutch"));
    const csv = toCSV(rows);
    const path = join(outDir, "clutch-agencies.csv");
    await writeFile(path, csv);
    files.push([path, `${rows.length} agency records`]);
  }

  // Outscraper/Google Maps: real estate (180 records)
  {
    const rows = Array.from({ length: 180 }, (_, i) => makeRealEstateRecord(i, "outscraper"));
    const csv = toCSV(rows);
    const path = join(outDir, "outscraper-realestate.csv");
    await writeFile(path, csv);
    files.push([path, `${rows.length} real estate records`]);
  }

  // Chamber of Commerce: legal services (160 records)
  {
    const rows = Array.from({ length: 160 }, (_, i) => makeLegalRecord(i, "chamber"));
    const csv = toCSV(rows);
    const path = join(outDir, "chamber-legal.csv");
    await writeFile(path, csv);
    files.push([path, `${rows.length} legal records`]);
  }

  // UpCity: additional agencies (150 records)
  {
    const rows = Array.from({ length: 150 }, (_, i) => makeAgencyRecord(i + 2000, "upcity"));
    const csv = toCSV(rows);
    const path = join(outDir, "upcity-agencies.csv");
    await writeFile(path, csv);
    files.push([path, `${rows.length} agency records`]);
  }

  console.log("✓ Generated seed data:");
  for (const [path, desc] of files) {
    console.log(`  ${path}: ${desc}`);
  }
  const total = files.reduce((sum, [, desc]) => {
    const n = parseInt(desc);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  console.log(`\n  Total records: ${total}`);
  console.log("\nNext: bun run leads/scripts/merge.ts to combine and deduplicate");
}

main().catch(e => { console.error(e); process.exit(1); });
