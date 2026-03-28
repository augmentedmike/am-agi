/**
 * Pipeline orchestrator — runs all stages end-to-end.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { parseJD, type ParsedJD } from "./jd-parser.ts";
import { scoreResume, scoreTextAgainstJD } from "./scorer.ts";
import { rewriteResume } from "./rewriter.ts";
import { buildMarkdown, renderResume } from "./renderer.ts";
import { trackApplication } from "./tracker.ts";

const MASTER_RESUME_PATH = join(import.meta.dir, "..", "master-resume.json");

function loadMasterResume() {
  return JSON.parse(readFileSync(MASTER_RESUME_PATH, "utf-8"));
}

export interface PipelineOptions {
  jdText: string;
  outputDir: string;
  topN?: number;
  verbose?: boolean;
}

export interface PipelineResult {
  jd: ParsedJD;
  baseline_score: number;
  tailored_score: number;
  improvement_pct: number;
  quality_gate_passed: boolean;
  output_md: string;
  output_pdf: string;
  filename_base: string;
  application_id: string;
  jd_path: string;
  log: string[];
}

export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const { jdText, outputDir, topN = 12, verbose = false } = opts;
  const log: string[] = [];

  const master = loadMasterResume();

  function info(msg: string) {
    log.push(msg);
    if (verbose) console.log(msg);
  }

  // Stage 1: Parse JD
  info("📋 Parsing job description...");
  const jd = await parseJD(jdText);
  info(`   Role: ${jd.role} @ ${jd.company}`);
  info(`   Keywords extracted: ${jd.keywords.length}`);
  info(`   Must-haves: ${jd.must_haves.length}, Nice-to-haves: ${jd.nice_to_haves.length}`);

  // Stage 2: Score resume bullets
  info("\n📊 Scoring resume against JD...");
  const scoring = scoreResume(master, jd, topN);
  info(`   Baseline score: ${(scoring.baseline_score * 100).toFixed(1)}%`);
  info(`   Top ${topN} bullets selected`);

  if (verbose) {
    info("\n   Top bullet scores:");
    scoring.top_bullets.slice(0, 5).forEach((b, i) => {
      info(`   ${i + 1}. [${(b.score * 100).toFixed(1)}%] ${b.bullet_text.slice(0, 80)}...`);
    });
  }

  // Stage 3: Rewrite with Claude
  info("\n✍️  Rewriting resume with Claude...");
  const tailored = await rewriteResume(master, jd, scoring.top_bullets);

  if (!tailored.hallucination_check.passed) {
    info(`\n⚠️  Hallucination check violations:`);
    tailored.hallucination_check.violations.forEach((v) => info(`   - ${v}`));
  } else {
    info("   ✓ Hallucination check passed");
  }

  // Stage 4: Build markdown
  info("\n📝 Rendering resume...");
  const markdownContent = buildMarkdown(
    master.meta,
    tailored,
    jd,
    master.experience
  );

  // Stage 5: Render to MD + PDF
  const rendered = renderResume(outputDir, markdownContent, jd);
  info(`   Markdown: ${rendered.markdown_path}`);
  info(`   PDF: ${rendered.pdf_path}`);

  // Stage 6: Quality gate
  const tailoredScore = scoreTextAgainstJD(markdownContent, jd);
  const improvement =
    scoring.baseline_score > 0
      ? ((tailoredScore - scoring.baseline_score) / scoring.baseline_score) * 100
      : tailoredScore * 100;

  const REQUIRED_IMPROVEMENT = 20; // percent
  const qualityGatePassed = improvement >= REQUIRED_IMPROVEMENT;

  info(`\n🔍 Quality Gate:`);
  info(`   Baseline score: ${(scoring.baseline_score * 100).toFixed(1)}%`);
  info(`   Tailored score: ${(tailoredScore * 100).toFixed(1)}%`);
  info(`   Improvement: ${improvement.toFixed(1)}% (required: ${REQUIRED_IMPROVEMENT}%)`);
  info(`   Gate: ${qualityGatePassed ? "✅ PASSED" : "❌ FAILED"}`);

  // Stage 7: Save JD JSON alongside output
  const appDir = join(outputDir);
  if (!existsSync(appDir)) mkdirSync(appDir, { recursive: true });
  const jdPath = join(outputDir, `${rendered.filename_base}-jd.json`);
  writeFileSync(jdPath, JSON.stringify(jd, null, 2), "utf-8");

  // Stage 8: Track application
  const appRecord = trackApplication(
    jd,
    rendered.pdf_path,
    scoring.baseline_score,
    tailoredScore
  );
  info(`\n📁 Application tracked: ${appRecord.id}`);

  return {
    jd,
    baseline_score: scoring.baseline_score,
    tailored_score: tailoredScore,
    improvement_pct: improvement,
    quality_gate_passed: qualityGatePassed,
    output_md: rendered.markdown_path,
    output_pdf: rendered.pdf_path,
    filename_base: rendered.filename_base,
    application_id: appRecord.id,
    jd_path: jdPath,
    log,
  };
}
