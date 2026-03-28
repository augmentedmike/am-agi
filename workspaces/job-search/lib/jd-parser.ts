/**
 * JD Parser — extracts structured requirements from a raw job description
 * using Claude via Anthropic SDK.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface ParsedJD {
  role: string;
  company: string;
  role_slug: string;
  company_slug: string;
  must_haves: string[];
  nice_to_haves: string[];
  keywords: string[];
  tone: string;
  culture_signals: string[];
  raw_snippet: string; // first 500 chars for tracker
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function parseJD(jdText: string): Promise<ParsedJD> {
  const client = new Anthropic();

  const prompt = `You are a precise job description analyst. Extract structured data from the following job posting.

Return ONLY valid JSON with this exact schema:
{
  "role": "exact job title",
  "company": "company name",
  "must_haves": ["skill or requirement 1", ...],
  "nice_to_haves": ["skill or requirement 1", ...],
  "keywords": ["keyword1", "keyword2", ...],
  "tone": "one of: startup/enterprise/technical/casual/formal",
  "culture_signals": ["signal1", ...]
}

Rules:
- must_haves: things listed as required/essential/must
- nice_to_haves: things listed as preferred/bonus/nice-to-have
- keywords: important technical terms, tools, methodologies from the JD (20-40 items)
- tone: assess based on language and company signals
- culture_signals: hints about culture (fast-paced, remote-first, mission-driven, etc.)

Job Description:
---
${jdText}
---

Return only the JSON object, no commentary.`;

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? "claude-opus-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  let parsed: Omit<ParsedJD, "role_slug" | "company_slug" | "raw_snippet">;
  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${e}\nResponse: ${content.text}`);
  }

  return {
    ...parsed,
    role_slug: slugify(parsed.role),
    company_slug: slugify(parsed.company),
    raw_snippet: jdText.slice(0, 500),
  };
}
