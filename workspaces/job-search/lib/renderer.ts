/**
 * Renderer — builds Markdown resume from tailored content, converts to PDF via Pandoc.
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { TailoredResume, TailoredBullet } from "./rewriter.ts";
import type { ParsedJD } from "./jd-parser.ts";

interface MasterResumeMeta {
  name: string;
  location: string;
  github: string;
  sites: string[];
  relocation: string;
}

interface MasterResumeExperience {
  id: string;
  title: string;
  company: string;
  start: string;
  end: string;
  bullets: Array<{ id: string; text: string }>;
}

interface GroupedBullets {
  [experienceId: string]: {
    title: string;
    company: string;
    start: string;
    end: string;
    bullets: TailoredBullet[];
  };
}

export function buildMarkdown(
  meta: MasterResumeMeta,
  tailored: TailoredResume,
  jd: ParsedJD,
  masterExperiences: MasterResumeExperience[]
): string {
  // Group bullets by experience
  const grouped: GroupedBullets = {};
  for (const bullet of tailored.bullets) {
    if (!grouped[bullet.experience_id]) {
      const exp = masterExperiences.find((e) => e.id === bullet.experience_id);
      if (!exp) continue;
      grouped[bullet.experience_id] = {
        title: exp.title,
        company: exp.company,
        start: exp.start,
        end: exp.end,
        bullets: [],
      };
    }
    grouped[bullet.experience_id].bullets.push(bullet);
  }

  const lines: string[] = [];

  // Header
  lines.push(`# ${meta.name}`);
  lines.push(``);
  lines.push(`${meta.location} | ${meta.relocation}`);
  lines.push(``);
  lines.push(`GitHub: ${meta.github} | ${meta.sites[0]}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Summary
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(tailored.summary);
  lines.push(``);

  // Experience
  lines.push(`## Experience`);
  lines.push(``);

  for (const [expId, group] of Object.entries(grouped)) {
    lines.push(`### ${group.title} — ${group.company}`);
    lines.push(`*${group.start}–${group.end}*`);
    lines.push(``);
    for (const bullet of group.bullets) {
      lines.push(`- ${bullet.tailored_text}`);
    }
    lines.push(``);
  }

  // Skills (always from master)
  lines.push(`## Skills`);
  lines.push(``);
  lines.push(`**Programming:** C, C++, C#, JavaScript/TypeScript, Python, Ruby, Perl, LISP, Assembly`);
  lines.push(``);
  lines.push(`**AI/ML:** LLMs, VLMs, VLAs, Fine-Tuning, RLHF, PPO, DPO, GRPO, Synthetic Data, Multimodal Systems, Reinforcement Learning, Speech Synthesis`);
  lines.push(``);
  lines.push(`**Systems:** Distributed Systems, Microservices, Agent Frameworks, Vector Memory/RAG, Autonomous Coding Systems, APIs, DevOps`);
  lines.push(``);

  return lines.join("\n");
}

export interface RenderOutput {
  markdown_path: string;
  pdf_path: string;
  filename_base: string;
}

export function renderResume(
  outputDir: string,
  markdownContent: string,
  jd: ParsedJD
): RenderOutput {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filenameBase = `michael-oneal-${jd.role_slug}-${jd.company_slug}-${date}`;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const mdPath = join(outputDir, `${filenameBase}.md`);
  const pdfPath = join(outputDir, `${filenameBase}.pdf`);

  writeFileSync(mdPath, markdownContent, "utf-8");

  // Convert to PDF via Pandoc — ATS-safe: no tables, single column, standard fonts
  try {
    execSync(
      `pandoc "${mdPath}" -o "${pdfPath}" \
        --pdf-engine=xelatex \
        -V geometry:margin=1in \
        -V fontsize=11pt \
        -V mainfont="DejaVu Sans" \
        2>&1`,
      { stdio: "pipe" }
    );
  } catch (e1) {
    // Fallback: try pdflatex engine
    try {
      execSync(
        `pandoc "${mdPath}" -o "${pdfPath}" \
          --pdf-engine=pdflatex \
          -V geometry:margin=1in \
          -V fontsize=11pt \
          2>&1`,
        { stdio: "pipe" }
      );
    } catch (e2) {
      // Final fallback: wkhtmltopdf via HTML conversion
      try {
        const htmlPath = join(outputDir, `${filenameBase}.html`);
        execSync(`pandoc "${mdPath}" -o "${htmlPath}" 2>&1`, { stdio: "pipe" });
        execSync(`wkhtmltopdf "${htmlPath}" "${pdfPath}" 2>&1`, { stdio: "pipe" });
      } catch (e3) {
        console.warn(
          `⚠️  PDF generation failed (pandoc/wkhtmltopdf not available). Markdown saved at ${mdPath}`
        );
        console.warn(`   Install pandoc + LaTeX: brew install pandoc mactex`);
        return { markdown_path: mdPath, pdf_path: mdPath, filename_base: filenameBase };
      }
    }
  }

  return { markdown_path: mdPath, pdf_path: pdfPath, filename_base: filenameBase };
}
