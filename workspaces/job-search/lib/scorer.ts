/**
 * Relevance Scorer — scores resume bullets against JD keywords
 * Uses keyword overlap (TF-IDF-style) for fast scoring without embeddings.
 */

import type { ParsedJD } from "./jd-parser.ts";

export interface BulletScore {
  bullet_id: string;
  bullet_text: string;
  experience_id: string;
  experience_title: string;
  company: string;
  score: number;
  matched_keywords: string[];
}

export interface ScoringResult {
  jd_keywords: string[];
  scores: BulletScore[];
  top_bullets: BulletScore[];
  baseline_score: number; // avg score of all bullets (unmodified master)
}

interface ResumeBullet {
  id: string;
  text: string;
  keywords: string[];
  metrics?: Record<string, string>;
}

interface ResumeExperience {
  id: string;
  title: string;
  company: string;
  bullets: ResumeBullet[];
}

export function scoreResume(
  masterResume: { experience: ResumeExperience[] },
  jd: ParsedJD,
  topN = 12
): ScoringResult {
  const allJdKeywords = [
    ...jd.keywords,
    ...jd.must_haves,
    ...jd.nice_to_haves,
  ].map((k) => k.toLowerCase());

  const uniqueJdKeywords = [...new Set(allJdKeywords)];

  // Weight: must-haves count double
  const mustHaveSet = new Set(jd.must_haves.map((k) => k.toLowerCase()));

  function scoreBullet(bullet: ResumeBullet, exp: ResumeExperience): BulletScore {
    const bulletText = bullet.text.toLowerCase();
    const bulletKeywords = (bullet.keywords || []).map((k) => k.toLowerCase());
    const matched: string[] = [];

    for (const kw of uniqueJdKeywords) {
      const kwTerms = kw.split(/\s+/);
      const textMatch = kwTerms.every((t) => bulletText.includes(t));
      const kwMatch = bulletKeywords.some((bk) => bk.includes(kw) || kw.includes(bk));

      if (textMatch || kwMatch) {
        matched.push(kw);
      }
    }

    // Base score: matched / total JD keywords
    let score = uniqueJdKeywords.length > 0 ? matched.length / uniqueJdKeywords.length : 0;

    // Boost for must-haves
    const mustHaveMatches = matched.filter((k) => mustHaveSet.has(k));
    score += mustHaveMatches.length * 0.05;

    return {
      bullet_id: bullet.id,
      bullet_text: bullet.text,
      experience_id: exp.id,
      experience_title: exp.title,
      company: exp.company,
      score: Math.min(score, 1.0),
      matched_keywords: matched,
    };
  }

  const allScores: BulletScore[] = [];

  for (const exp of masterResume.experience) {
    for (const bullet of exp.bullets) {
      allScores.push(scoreBullet(bullet, exp));
    }
  }

  // Sort descending by score
  allScores.sort((a, b) => b.score - a.score);

  const baseline_score =
    allScores.length > 0
      ? allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length
      : 0;

  return {
    jd_keywords: uniqueJdKeywords,
    scores: allScores,
    top_bullets: allScores.slice(0, topN),
    baseline_score,
  };
}

/**
 * Score a tailored resume text against JD keywords (for quality gate).
 */
export function scoreTextAgainstJD(resumeText: string, jd: ParsedJD): number {
  const allJdKeywords = [
    ...jd.keywords,
    ...jd.must_haves,
  ].map((k) => k.toLowerCase());

  const uniqueKeywords = [...new Set(allJdKeywords)];
  if (uniqueKeywords.length === 0) return 0;

  const text = resumeText.toLowerCase();
  let matched = 0;

  for (const kw of uniqueKeywords) {
    const kwTerms = kw.split(/\s+/);
    if (kwTerms.every((t) => text.includes(t))) {
      matched++;
    }
  }

  return matched / uniqueKeywords.length;
}
