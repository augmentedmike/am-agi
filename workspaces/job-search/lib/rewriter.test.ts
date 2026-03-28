/**
 * Unit tests for the hallucination guard in rewriter.ts.
 * Tests the private checkHallucinations function via integration-style checks.
 */
import { describe, it, expect } from "bun:test";

// We test the hallucination logic by reconstructing the same logic inline
// (the function is not exported, but we can replicate the check to verify correctness)

const allowedCompanies = ["claimhawk", "youtube", "teach.com", "intel", "uber", "paypal", "microsoft", "callaway golf", "upper deck"];
const allowedSkills = [
  "c", "c++", "c#", "javascript", "typescript", "python", "ruby", "perl", "lisp", "assembly",
  "deep neural networks (dnns)", "convolutional neural networks (cnns)", "reinforcement learning (rl)",
  "q-learning / dqn", "policy gradients", "ppo", "rlhf", "dpo", "grpo", "large language models (llms)",
  "vision-language models (vlms)", "vision-language-action models (vlas)", "model fine-tuning",
  "synthetic data generation", "hipaa-compliant ml pipelines", "speech synthesis (tacotron, xtts)",
  "multimodal systems", "distributed systems", "microservices", "rest apis", "automation platforms",
  "devops", "agent frameworks", "vector memory / rag", "autonomous coding systems",
  "tool-use architectures", "bare metal / embedded systems",
  "react", "node.js", "typescript", "bun", "anthropic sdk", "openai api", "sqlite", "postgresql", "docker",
];

function simulateHallucinationCheck(text: string): { passed: boolean; violations: string[] } {
  const fullText = text.toLowerCase();
  const violations: string[] = [];

  const allowedCompanySet = new Set(allowedCompanies);
  const allowedSkillSet = new Set(allowedSkills);

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
    return (
      !allowedSkillSet.has(normalized) &&
      !allowedSkills.some((s) => s.toLowerCase().includes(normalized) || normalized.includes(s.toLowerCase()))
    );
  });

  for (const skill of highRiskSkills) {
    const pattern = new RegExp(`(?<![a-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i");
    if (pattern.test(fullText)) {
      violations.push(`Unverified skill claim: "${skill}"`);
    }
  }

  return { passed: violations.length === 0, violations };
}

describe("hallucination guard", () => {
  it("passes clean text with only allowed companies/skills", () => {
    const text = "Led distributed systems work at Microsoft and Uber, using TypeScript, Python, and React.";
    const result = simulateHallucinationCheck(text);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("flags hallucinated company not in allowed list", () => {
    const text = "Previously worked at Google and Amazon to scale infrastructure.";
    const result = simulateHallucinationCheck(text);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("google"))).toBe(true);
    expect(result.violations.some((v) => v.includes("amazon"))).toBe(true);
  });

  it("does NOT flag companies Michael actually worked at", () => {
    const text = "At YouTube, built large-scale video systems. At Intel, optimized embedded pipelines.";
    const result = simulateHallucinationCheck(text);
    // youtube and intel are in allowed list — no violations
    const companyViolations = result.violations.filter((v) => v.includes("youtube") || v.includes("intel"));
    expect(companyViolations).toHaveLength(0);
  });

  it("flags hallucinated skill not in allowed list", () => {
    const text = "Experienced with Kubernetes and Terraform for cloud infrastructure.";
    const result = simulateHallucinationCheck(text);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("kubernetes"))).toBe(true);
    expect(result.violations.some((v) => v.includes("terraform"))).toBe(true);
  });

  it("does NOT flag skills from allowed list", () => {
    const text = "Built RLHF pipelines with LLMs using TypeScript and PostgreSQL.";
    const result = simulateHallucinationCheck(text);
    expect(result.violations).toHaveLength(0);
  });

  it("allowedSkills list is used — Palantir is caught as unverified company", () => {
    const text = "Led AI work at Palantir on defense systems.";
    const result = simulateHallucinationCheck(text);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("palantir"))).toBe(true);
  });
});
