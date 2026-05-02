import { resolve } from "node:path";

import { buildPrompt } from "../loop/build-prompt.ts";
import { BunFileSystem } from "../loop/filesystem.ts";
import { loadContext } from "../loop/load-context.ts";
import { buildSystemPrompt } from "../loop/system-prompt.ts";
import type { ClaudeResult } from "../loop/types.ts";
import { type ProviderConfig, resolveProviderConfig } from "./provider.ts";
import { HARNESS_TOOLS, type HarnessToolCall, runHarnessTool } from "./tools.ts";

type Role = "system" | "user" | "assistant" | "tool";

interface ChatMessage {
  role: Role;
  content?: string;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
}

interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatResponse {
  choices?: Array<{
    message?: ChatMessage;
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface AmHarnessOptions {
  workDir: string;
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  prompt?: string;
  systemPrompt?: string;
  maxSteps?: number;
  toolTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}

export interface AmHarnessResult extends ClaudeResult {
  provider: string;
  model: string;
  steps: number;
}

export async function runAmHarness(options: AmHarnessOptions): Promise<AmHarnessResult> {
  const workDir = resolve(options.workDir);
  const provider = resolveProviderConfig({
    provider: options.provider,
    model: options.model,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    apiKeyEnv: options.apiKeyEnv,
    env: options.env,
  });
  const fs = new BunFileSystem();
  const ctx = await loadContext(workDir, fs);
  const userPrompt = options.prompt ?? buildPrompt(ctx);
  const systemPrompt = options.systemPrompt ?? buildSystemPrompt(workDir);
  const maxSteps = options.maxSteps ?? 20;
  const toolTimeoutMs = options.toolTimeoutMs ?? 120_000;
  const fetchImpl = options.fetchImpl ?? fetch;

  const messages: ChatMessage[] = [
    { role: "system", content: buildHarnessSystemPrompt(systemPrompt) },
    { role: "user", content: userPrompt },
  ];

  let finalText = "";
  let usage: ClaudeResult["usage"] | undefined;

  for (let step = 1; step <= maxSteps; step++) {
    const response = await callModel(provider, messages, fetchImpl);
    usage = normalizeUsage(response.usage) ?? usage;
    const message = response.choices?.[0]?.message;
    if (!message) throw new Error("model response did not include a message");

    messages.push(message);
    const calls = toHarnessToolCalls(message.tool_calls);
    if (calls.length === 0) {
      finalText = message.content ?? "";
      return {
        exitCode: 0,
        result: finalText,
        usage,
        provider: provider.provider,
        model: provider.model,
        steps: step,
      };
    }

    for (const call of calls) {
      const result = await runHarnessTool(call, { workDir, timeoutMs: toolTimeoutMs });
      messages.push({
        role: "tool",
        tool_call_id: result.toolCallId,
        content: result.content,
      });
    }
  }

  return {
    exitCode: 1,
    result: `am-cli stopped after max steps (${maxSteps}) without a final answer`,
    usage,
    provider: provider.provider,
    model: provider.model,
    steps: maxSteps,
  };
}

function buildHarnessSystemPrompt(base: string): string {
  return `${base}

## am-cli harness

You are running inside am-cli, AM's provider-neutral agent harness. Use tools to inspect and edit the workspace directly. Prefer small, verifiable changes. Run relevant checks before finishing. When the task is complete, respond with a concise summary and include DONE on its own line.`;
}

async function callModel(
  provider: ProviderConfig,
  messages: ChatMessage[],
  fetchImpl: FetchLike,
): Promise<ChatResponse> {
  const res = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      tools: HARNESS_TOOLS,
      tool_choice: "auto",
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${provider.provider} request failed (${res.status}): ${body}`);
  }

  const parsed = JSON.parse(body) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("model response was not a JSON object");
  }
  return parsed as ChatResponse;
}

function toHarnessToolCalls(calls: ChatToolCall[] | undefined): HarnessToolCall[] {
  return (calls ?? []).map((call) => ({
    id: call.id,
    name: call.function.name,
    argumentsJson: call.function.arguments,
  }));
}

function normalizeUsage(usage: ChatResponse["usage"]): ClaudeResult["usage"] | undefined {
  if (!usage) return undefined;
  return {
    input_tokens: usage.prompt_tokens ?? 0,
    output_tokens: usage.completion_tokens ?? 0,
    cache_read_input_tokens: usage.prompt_cache_hit_tokens ?? 0,
    cache_creation_input_tokens: usage.prompt_cache_miss_tokens ?? 0,
  };
}
