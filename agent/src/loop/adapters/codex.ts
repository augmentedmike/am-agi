import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentAdapter, AdapterCapabilities, AdapterInvokeOptions, AdapterResult } from "../adapter";
import { ProviderAuthError } from "../errors";

export class CodexAdapter implements AgentAdapter {
  readonly providerId = "codex";
  readonly modelId: string;
  readonly capabilities: AdapterCapabilities = {
    streaming: false,
    vision: true,
    structuredOutput: true,
  };

  private readonly codexPath: string;

  constructor(modelId = "gpt-5.1-codex", codexPath = "codex") {
    this.modelId = modelId;
    this.codexPath = codexPath;
  }

  async invoke(
    workDir: string,
    prompt: string,
    options: AdapterInvokeOptions = {},
  ): Promise<AdapterResult> {
    const resolvedCodex = Bun.which(this.codexPath, { PATH: process.env.PATH ?? "" }) ?? this.codexPath;
    const tempDir = mkdtempSync(join(tmpdir(), "am-codex-"));
    const outputPath = join(tempDir, "last-message.txt");
    const model = options.model ?? this.modelId;
    const fullPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n---\n\n${prompt}`
      : prompt;

    const args = [
      "exec",
      "--cd", workDir,
      "--sandbox", "workspace-write",
      "--ask-for-approval", "never",
      "--output-last-message", outputPath,
    ];
    if (model) args.push("--model", model);
    args.push("-");

    try {
      const proc = Bun.spawn([resolvedCodex, ...args], {
        cwd: workDir,
        env: process.env,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      proc.stdin.write(fullPrompt);
      proc.stdin.end();

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      const combined = `${stdout}\n${stderr}`.trim();

      if (exitCode !== 0 && isAuthFailure(combined)) {
        throw new ProviderAuthError(this.providerId, combined.slice(0, 500));
      }

      const result = existsSync(outputPath)
        ? readFileSync(outputPath, "utf8").trim()
        : stdout.trim();

      return {
        exitCode,
        result: result || combined,
      };
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

function isAuthFailure(output: string): boolean {
  const lower = output.toLowerCase();
  return [
    "not logged in",
    "authentication",
    "unauthorized",
    "invalid api key",
    "api key",
    "credentials",
    "401",
    "403",
  ].some(pattern => lower.includes(pattern));
}
