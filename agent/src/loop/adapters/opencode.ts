import type { AgentAdapter, AdapterInvokeOptions, AdapterResult } from "../adapter";
import type { StreamEvent } from "../invoke-claude";
import { existsSync, mkdirSync, appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export class OpencodeAuthError extends Error {
  constructor(message = "Opencode auth expired") {
    super(message);
    this.name = "OpencodeAuthError";
  }
}

function writeIterJsonl(workDir: string, text: string): void {
  const iterDir = join(workDir, "iter");

  let latestIter = 0;
  if (existsSync(iterDir)) {
    try {
      const entries = readdirSync(iterDir);
      for (const entry of entries) {
        const n = parseInt(entry, 10);
        if (!isNaN(n) && n > latestIter) latestIter = n;
      }
    } catch { /* ignore */ }
  }

  const iterNum = latestIter > 0 ? latestIter : 1;
  const iterPath = join(iterDir, String(iterNum));
  mkdirSync(iterPath, { recursive: true });

  const jsonlPath = join(iterPath, "agent.jsonl");
  const entry = {
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
    },
    timestamp: new Date().toISOString(),
  };
  appendFileSync(jsonlPath, JSON.stringify(entry) + "\n");
}

export class OpencodeAdapter implements AgentAdapter {
  readonly providerId = "opencode";
  readonly modelId: string;

  constructor(modelId = "qwen3-coder") {
    this.modelId = modelId;
  }

  async invoke(
    workDir: string,
    prompt: string,
    options: AdapterInvokeOptions = {},
  ): Promise<AdapterResult> {
    const opencodePath = await Bun.which("opencode");
    if (!opencodePath) {
      throw new Error("opencode not found in PATH");
    }

    const fullPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n---\n\n${prompt}`
      : prompt;

    const args: string[] = ["run", "--format", "json"];

    if (options.model) {
      args.push("--model", options.model);
    } else if (this.modelId) {
      args.push("--model", this.modelId);
    }

    args.push(fullPrompt);

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value;
    }
    delete env.OPENCODE_CONFIG;
    delete env.OPENCODE_CONFIG_DIR;

    const proc = Bun.spawn(
      [opencodePath, ...args],
      {
        cwd: workDir,
        env,
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      },
    );

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let lineBuffer = "";
    let resultText = "";
    let usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } | undefined;
    let errorText = "";

    const readStdout = async () => {
      for await (const chunk of proc.stdout as AsyncIterable<Uint8Array>) {
        const text = new TextDecoder().decode(chunk);
        stdoutBuffer += text;
        process.stdout.write(chunk);

        lineBuffer += text;
        let newlineIdx: number;
        while ((newlineIdx = lineBuffer.indexOf("\n")) !== -1) {
          const line = lineBuffer.slice(0, newlineIdx).trim();
          lineBuffer = lineBuffer.slice(newlineIdx + 1);
          if (!line) continue;

          try {
            const event = JSON.parse(line) as Record<string, unknown>;
            const eventType = event.type as string;

            if (options.onEvent) {
              options.onEvent(event as unknown as StreamEvent);
            }

            if (eventType === "text") {
              const part = event.part as Record<string, unknown> | undefined;
              if (part?.text) {
                resultText += part.text as string;
              }
            } else if (eventType === "step_finish") {
              const part = event.part as Record<string, unknown> | undefined;
              if (part?.tokens) {
                const tokens = part.tokens as Record<string, unknown>;
                const cache = (tokens.cache ?? {}) as Record<string, unknown>;
                usage = {
                  inputTokens: (tokens.input as number) ?? 0,
                  outputTokens: (tokens.output as number) ?? 0,
                  cacheReadTokens: (cache.read as number) ?? 0,
                  cacheWriteTokens: (cache.write as number) ?? 0,
                };
              }
            } else if (eventType === "error") {
              const err = event.error as Record<string, unknown> | undefined;
              if (err?.message) {
                errorText += err.message as string;
              }
            }
          } catch {
            // skip
          }
        }
      }
    };

    const readStderr = async () => {
      for await (const chunk of proc.stderr as AsyncIterable<Uint8Array>) {
        stderrBuffer += new TextDecoder().decode(chunk);
      }
    };

    await Promise.all([readStdout(), readStderr()]);
    const exitCode = await proc.exited;

    const combined = stdoutBuffer + stderrBuffer;

    const authPatterns = ["authentication", "unauthorized", "401", "token expired", "oauth", "invalid api key", "api key", "credentials"];
    if (exitCode !== 0 && authPatterns.some(p => combined.toLowerCase().includes(p))) {
      throw new OpencodeAuthError(combined.trim().slice(0, 500));
    }

    if (exitCode !== 0 && errorText) {
      resultText += `\n\nError: ${errorText}`;
    }

    if (resultText) {
      writeIterJsonl(workDir, resultText);
    }

    return {
      exitCode,
      result: resultText,
      usage,
    };
  }
}
