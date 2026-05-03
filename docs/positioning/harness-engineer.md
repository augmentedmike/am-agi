# AM for Harness Engineers: A Reference Architecture for Agent Frameworks

*Why AM's walled-garden architecture is the right foundation for building agent systems that are secure, auditable, and quality-gated.*

---

## Who This Is For

You're building an agent framework, harness, or orchestration system. You want to understand how AM is architected — not just what it does, but *how* it does it and why those decisions matter.

This document is for engineers evaluating AM as:

- A **reference architecture** for your own agent harness
- A **foundation** you can fork, extend, or adopt directly
- A **point of comparison** against LangChain, CrewAI, OpenAI Agents SDK, OpenClaw, and Claude Code

You'll find: the key architectural components, a comparison table across multiple dimensions, and the design philosophy that makes AM different from everything else.

---

## AM as an Agent Harness Architecture

AM is an agent-driven development system built around three architectural pillars: an **adapter interface** for model-agnostic invocation, a **gate worker** for deterministic quality enforcement, and **worktree isolation** for process- and filesystem-level separation.

### 1. Adapter Interface (`agent/src/loop/adapter.ts`)

AM's agent loop never touches a model provider directly. All model invocation flows through the `AgentAdapter` interface:

```typescript
interface AgentAdapter {
  readonly providerId: string;  // e.g. "claude", "deepseek"
  readonly modelId: string;     // e.g. "claude-sonnet-4-5"
  invoke(
    workDir: string,
    prompt: string,
    options?: AdapterInvokeOptions
  ): Promise<AdapterResult>;
}
```

**What this gives you:**
- **Provider agnosticism** — Swap Claude, DeepSeek, Qwen, or any OpenAI-compatible API by changing environment variables. No code changes.
- **Clean separation** — The agent loop (`runIteration`) calls `adapter.invoke()` and gets back a normalized `{ exitCode, result, usage }`. It never sees provider-specific details.
- **Two concrete implementations today** — `ClaudeAdapter` (subprocess-based) and `OpenAICompatibleAdapter` (HTTP-based via the `openai` npm client). Both implement the same interface.
- **Factory resolution** — `queryAdapter(workDir, env)` reads `am.project.json` for per-project adapter config, falling back to `resolveAdapter(env)` which checks `AM_PROVIDER`, `AM_BASE_URL`, `AM_API_KEY` env vars.

**Why this matters:** Most agent frameworks (LangChain, CrewAI) embed model selection in orchestration logic. AM treats it as a thin translation layer — the harness doesn't care which model is running. This makes it trivial to add new providers, run different models per project, and avoid vendor lock-in.

*Source: `agent/src/loop/adapter.ts:1-120`*

### 2. Gate Worker (`board/src/worker/gates.ts`)

AM's gate worker is the core of its **deterministic quality enforcement**. Before any card transitions state, the gate runs server-side checks that the agent cannot influence:

```
backlog → in-progress: research.md + criteria.md must exist and be well-formed
in-progress → in-review: todo.md must be complete, bun test must pass
in-review → shipped: every criterion verified in agent.log, tests pass, no code quality violations
```

**Key design properties:**
- **Agent cannot self-certify** — The gate re-runs `bun test` server-side. It doesn't take the agent's word that tests pass.
- **Deterministic checks** — Every gate check is a pure function or a deterministic side effect (file read, test run). No model calls, no heuristics.
- **Specific failure messages** — Gate failures return exact reasons: "criteria.md must contain at least one numbered criterion (1. ...)" — the agent can fix and retry.
- **Baseline comparison for tests** — Gate runs tests against the merge-base branch to distinguish pre-existing failures from new ones. Only new failures block the transition.

**Why this matters:** Every other agent framework (OpenClaw, LangChain, CrewAI, Claude Code) trusts the agent to report its own results. AM does not. The gate is an independent verifier that sits between the agent and the state machine. This is the architectural difference that prevents "ClawJacked"-style vulnerabilities where an injected agent can claim success and proceed unchecked.

*Source: `board/src/worker/gates.ts:1-280`*

### 3. Worktree Isolation Model

Every AM task runs in its own git worktree with a dedicated branch:

```
am-<card-slug>/          ← git worktree, branch card/<card-slug>
  work.md                ← column prompt + card context
  criteria.md            ← numbered acceptance criteria
  research.md            ← file paths or URLs
  todo.md                ← flat checklist
  iter/1/agent.log       ← traceable iteration history
  iter/2/agent.log
  ...
```

**Isolation properties:**
- **Process isolation** — Each agent spawns with `cwd: workDir` and `stdin: "ignore"`. No inbound network surface. No cross-task interference.
- **Filesystem isolation** — Agent can only write to its own worktree. Cannot see other card state.
- **Auth isolation** — Auth env vars (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`) are stripped before spawn.
- **Computed state** — Iteration count, test status, priority order are all derived at runtime from filesystem state, not from cached booleans that could be poisoned.

**Why this matters:** OpenClaw's ClawJacked vulnerability exists because it has no process boundaries — its WebSocket gateway is accessible from any JavaScript on any page. AM's worktree isolation means the agent has no network surface, no shared filesystem, and no way to persist malicious state across tasks.

*Source: `docs/ARCHITECTURE.md` ("Card Worktrees" section)*

---

## Comparison: AM vs Other Agent Harnesses

| Dimension | AM | LangChain | CrewAI | OpenAI Agents SDK | OpenClaw | Claude Code |
|---|---|---|---|---|---|---|
| **Provider model** | Adapter interface (swappable per project via `am.project.json`) | Python abstractions with model-specific integrations | Python, role-based model assignment | Node.js SDK, OpenAI-only, function calling | Plugin system with model backends | Anthropic-only (Claude) |
| **State enforcement** | Server-side gate worker: deterministic checks, agent cannot self-certify | No gate; agent output is state | No gate; task completion declared by agent | No gate; tool call outputs are state | No gate; agent output IS state | No gate; agent reports done |
| **Process isolation** | Per-task git worktree, `stdin: ignore`, stripped auth env vars | Library in host process | Library in host process | Library in host process | Shared process, network-accessible WebSocket gateway | Single process, no isolation |
| **Injection surface** | Static prompts only; card title is data, not instructions | Prompt templates can include user input | Task descriptions can include user input | System messages built from user input | Any email, webpage, or document can inject | User prompt is instruction |
| **Execution traceability** | Every iteration is a git commit; full agent.log per iteration | No built-in trace; relies on LangSmith (external) | No built-in trace; relies on external logging | No built-in trace; relies on SDK callbacks | Agent log files, no git integration | Session transcripts, no git commit history |
| **Adapter portability** | Swap provider via env vars or `am.project.json` — zero code changes | Provider is part of the chain definition | Model is assigned per agent role | OpenAI-only | Plugin per model backend | Single provider |
| **Memory model** | Short-term + long-term embeddings stored locally, git-backed | Conversation buffer memory, vector stores (external) | Task memory within crew run | Chat history in session | Self-modifying files (`SOUL`, `IDENTITY`) | Session context (lost on exit) |
| **Security philosophy** | Walled garden: narrow channels, server-side verification | No built-in security model | No built-in security model | Platform-managed (cloud) | "No perfectly secure setup" | Controlled execution environment |

---

## Why Architecture Matters for Harness Engineers

If you're evaluating agent frameworks to build on, these architectural decisions have real consequences:

### The Gate Worker Solves the "Who Guards the Guards?" Problem

Every agent framework faces the same fundamental question: *who decides when work is done?* 

In LangChain, CrewAI, and OpenAI Agents SDK, the agent decides. It calls a "done" tool, declares a task complete, or outputs a final answer. There's no independent verifier — the agent is judge in its own case.

AM answers differently: **nobody decides.** The gate worker determines deterministically whether criteria are met. Tests either pass or they don't. Files either exist or they don't. There's no judgement call, no agent assertion, no "trust me."

This is the same architectural insight that makes credit card transactions work: the merchant (agent) requests the charge, but the bank (gate) authorizes it. The merchant cannot authorize their own payments.

### Adapter Portability Is Free

Most agent frameworks tie you to one model ecosystem. Switching from Claude to DeepSeek in LangChain means rewriting chain definitions. In CrewAI, it means changing agent model assignments.

In AM, you set three environment variables (`AM_PROVIDER`, `AM_BASE_URL`, `AM_API_KEY`) or add an `adapter` block to `am.project.json`. The harness doesn't know or care. This isn't a feature bolt-on — it's a consequence of the adapter interface being a first-class architectural component rather than an afterthought.

### Worktree Isolation Prevents Entire Attack Classes

OpenClaw's ClawJacked vulnerability (Oasis Security, Feb 2026) — where any website can hijack a running agent via its local WebSocket gateway — is architecturally impossible in AM. There's no gateway to connect to. The agent process has no inbound network surface. It can't persist context or modify its own instructions.

This isn't a security patch. It's an architectural property: **if the agent can't hear you, it can't be injected.** The trade-off is narrower capability — AM can't do everything OpenClaw can — but it also can't be weaponized against its user.

---

## Getting Started as a Harness Engineer

### Quick architecture tour

```bash
# Read the adapter interface
agent/src/loop/adapter.ts

# Read the gate worker
board/src/worker/gates.ts

# Read the full architecture doc
docs/ARCHITECTURE.md

# Read the security comparison
docs/am-vs-openclaw.md
```

### Key files to extend

| What you want to do | File | What to change |
|---|---|---|
| Add a new model provider | `agent/src/loop/adapters/` | Implement `AgentAdapter` interface |
| Add a new gate check | `board/src/worker/gates.ts` | Add check in `checkGate()` for the relevant transition |
| Customize column prompts | `board/src/worker/prompts.ts` | Modify `BACKLOG_PROMPT`, `IN_PROGRESS_PROMPT`, `IN_REVIEW_PROMPT` |
| Change project adapter config format | `agent/src/loop/adapter.ts:queryAdapter()` | Modify the JSON parsing and config shape |

### Running the full system

```bash
# Clone and install
git clone https://github.com/augmentedmike/am-agi
cd am-agi
bun install

# Optional: configure a non-Claude adapter
export AM_PROVIDER=deepseek
export AM_BASE_URL=https://api.deepseek.com/v1
export AM_API_KEY=sk-...

# Start the board
bun run dev

# In another terminal: create your first card
source ./init.sh
board create --title "Hello AM" --priority high
```

---

## Further Reading

- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — Full system architecture
- [docs/am-vs-openclaw.md](../docs/am-vs-openclaw.md) — Security architecture comparison
- [agent/src/loop/adapter.ts](../agent/src/loop/adapter.ts) — Adapter interface source
- [board/src/worker/gates.ts](../board/src/worker/gates.ts) — Gate worker source
- [messaging.md](../messaging.md) — For small-team founders (different audience, same platform)
