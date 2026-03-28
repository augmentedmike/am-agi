/**
 * LLM Rewriter — rewrites resume summary and bullets to mirror JD language.
 * Strict truthfulness: no skills or companies outside master-resume.json.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ParsedJD } from "./jd-parser.ts";
import type { BulletScore } from "./scorer.ts";

export interface TailoredResume {
  summary: string;
  bullets: TailoredBullet[];
  hallucination_check: HallucinationCheckResult;
}

export interface TailoredBullet {
  original_id: string;
  experience_id: string;
  experience_title: string;
  company: string;
  original_text: string;
  tailored_text: string;
}

export interface HallucinationCheckResult {
  passed: boolean;
  violations: string[];
}

export async function rewriteResume(
  masterResume: {
    summary: { body: string };
    skills: Record<string, string[]>;
    companies_worked_with: string[];
  },
  jd: ParsedJD,
  topBullets: BulletScore[]
): Promise<TailoredResume> {
  const client = new Anthropic();

  // Build allowed sets for hallucination guard
  const allAllowedSkills = Object.values(masterResume.skills).flat().map((s) => s.toLowerCase());
  const allowedCompanies = masterResume.companies_worked_with.map((c) => c.toLowerCase());

  const bulletContext = topBullets
    .map(
      (b, i) =>
        `${i + 1}. [${b.experience_title} @ ${b.company}]\n   ${b.bullet_text}`
    )
    .join("\n");

  const systemPrompt = `You are a professional resume writer. Your ONLY job is to rephrase and reframe existing content to better match a job description.

ABSOLUTE RULES — violation means you have failed:
1. Never invent skills, tools, companies, or accomplishments not in the provided content
2. Never add credentials, certifications, or degrees not mentioned
3. Preserve all quantitative metrics exactly as given (percentages, dollar amounts, years)
4. Do not add new bullet points — only rewrite the ones provided
5. Mirror the JD's language and keywords naturally — don't keyword-stuff
6. Output must be concise and ATS-readable (no special formatting, no tables)`;

  const userPrompt = `Rewrite this resume content to target the following job.

JOB: ${jd.role} at ${jd.company}
MUST-HAVES: ${jd.must_haves.join(", ")}
KEY KEYWORDS: ${jd.keywords.slice(0, 20).join(", ")}
TONE: ${jd.tone}

ORIGINAL SUMMARY:
${masterResume.summary.body}

TOP SELECTED BULLETS (rewrite each one):
${bulletContext}

Return ONLY valid JSON with this schema:
{
  "summary": "rewritten summary (2-4 sentences)",
  "bullets": [
    {
      "index": 1,
      "original_text": "exact copy of original",
      "tailored_text": "rewritten version"
    },
    ...
  ]
}`;

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? "claude-opus-4-5",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  let parsed: { summary: string; bullets: Array<{ index: number; original_text: string; tailored_text: string }> };
  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Failed to parse rewriter response: ${e}\nResponse: ${content.text}`);
  }

  // Map back to bullets with experience context
  const tailoredBullets: TailoredBullet[] = parsed.bullets.map((b, i) => {
    const original = topBullets[b.index - 1] || topBullets[i];
    return {
      original_id: original?.bullet_id ?? `bullet-${i}`,
      experience_id: original?.experience_id ?? "",
      experience_title: original?.experience_title ?? "",
      company: original?.company ?? "",
      original_text: b.original_text,
      tailored_text: b.tailored_text,
    };
  });

  // Hallucination check
  const hallucinationCheck = checkHallucinations(
    parsed.summary,
    tailoredBullets,
    allAllowedSkills,
    allowedCompanies
  );

  return {
    summary: parsed.summary,
    bullets: tailoredBullets,
    hallucination_check: hallucinationCheck,
  };
}

function checkHallucinations(
  summary: string,
  bullets: TailoredBullet[],
  allowedSkills: string[],
  allowedCompanies: string[]
): HallucinationCheckResult {
  const violations: string[] = [];
  const fullText = [summary, ...bullets.map((b) => b.tailored_text)].join(" ").toLowerCase();

  // Normalise allowed sets to lowercase for comparison
  const allowedCompanySet = new Set(allowedCompanies.map((c) => c.toLowerCase()));
  const allowedSkillSet = new Set(allowedSkills.map((s) => s.toLowerCase()));

  // Comprehensive list of well-known companies that could be hallucinated.
  // Any that appear in the output but are NOT in allowedCompanies = violation.
  const knownCompanies = [
    "google", "alphabet", "amazon", "aws", "meta", "facebook", "instagram", "whatsapp",
    "apple", "netflix", "tesla", "openai", "deepmind", "databricks", "stripe", "airbnb",
    "lyft", "twitter", "x.com", "linkedin", "salesforce", "oracle", "ibm", "sap",
    "adobe", "nvidia", "amd", "qualcomm", "samsung", "sony", "github", "gitlab",
    "atlassian", "slack", "zoom", "dropbox", "box", "snowflake", "palantir",
    "shopify", "square", "block", "robinhood", "coinbase", "binance", "bytedance",
    "tiktok", "spotify", "twitch", "discord", "reddit", "pinterest", "snap",
    "anthropic", "mistral", "cohere", "hugging face", "huggingface", "stability ai",
    "midjourney", "waymo", "cruise", "rivian", "lucid", "spacex", "figure",
    "deloitte", "mckinsey", "accenture", "pwc", "kpmg", "bain", "ey",
    "goldman sachs", "jpmorgan", "morgan stanley", "blackrock", "citadel",
    "hulu", "disney", "warner", "comcast", "verizon", "at&t", "t-mobile",
  ].filter((c) => !allowedCompanySet.has(c));

  for (const co of knownCompanies) {
    if (fullText.includes(co)) {
      violations.push(`Unverified company reference: "${co}"`);
    }
  }

  // High-risk skills that are NOT in Michael's allowed skill set.
  // These are specific enough that their presence likely indicates hallucination.
  const highRiskSkills = [
    "kubernetes", "k8s", "terraform", "ansible", "jenkins", "circleci",
    "aws lambda", "google cloud", "gcp", "azure", "hadoop", "apache spark",
    "kafka", "elasticsearch", "redis", "mongodb", "cassandra", "neo4j",
    "swift", "kotlin", "golang", "scala", "java",
    "pytorch", "tensorflow", "keras", "scikit-learn", "pandas", "numpy",
    "blockchain", "smart contracts", "solidity", "web3",
    "figma", "sketch", "matlab", "julia", "fortran",
  ].filter((skill) => {
    const normalized = skill.toLowerCase();
    // Keep only if not covered by any allowed skill token
    return (
      !allowedSkillSet.has(normalized) &&
      !allowedSkills.some(
        (s) =>
          s.toLowerCase().includes(normalized) ||
          normalized.includes(s.toLowerCase())
      )
    );
  });

  for (const skill of highRiskSkills) {
    // Use word-boundary-like check: look for skill surrounded by non-word chars
    const pattern = new RegExp(`(?<![a-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i");
    if (pattern.test(fullText)) {
      violations.push(`Unverified skill claim: "${skill}"`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
