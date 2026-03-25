# Research: AM Walled Garden vs. OpenClaw Security Posture

## What is OpenClaw?

OpenClaw (formerly Clawdbot/Moltbot) is an open-source, self-hosted autonomous AI agent framework with wide adoption among developers. It can run shell commands, read/write files, execute scripts, process email, and integrate with messaging apps. It has attracted major security scrutiny throughout early 2026.

---

## OpenClaw: Documented Vulnerabilities

### 1. ClawJacked WebSocket Hijack (Feb 2026)
**Disclosed by:** Oasis Security
**Summary:** Any website can silently hijack a running OpenClaw agent via localhost WebSocket.
**Attack chain:**
- WebSocket connections to localhost bypass browser cross-origin policies
- The gateway exempts localhost from rate-limiting — allows hundreds of auth guesses/sec from JavaScript
- Local connections auto-approve device pairing without user confirmation

> "Any website you visit can open one to your localhost...while you're browsing any website, JavaScript running on that page can silently open a connection to your local OpenClaw gateway." — Oasis Security

Once authenticated, attacker gains full agent control: AI responses, configurations, connected device enumeration, logs.

**Source:** https://www.oasis.security/blog/openclaw-vulnerability
**Source:** https://thehackernews.com/2026/02/clawjacked-flaw-lets-malicious-sites.html

---

### 2. Indirect Prompt Injection
OpenClaw reads emails, fetches web content, and processes messages **without separating instructions from data**.

**Demonstrated attacks:**
- Attacker emails a prompt-injection payload to OpenClaw's linked inbox → agent retrieves private key from disk and exfiltrates it
- Malicious instructions embedded in Google Docs, Slack messages, fetched web pages redirect agent behavior
- Defense rates ranged from 17% (DeepSeek) to 83% (Claude) — **none are acceptable for production**

**Sources:**
- https://thehackernews.com/2026/03/openclaw-ai-agent-flaws-could-enable.html
- https://gbhackers.com/openclaw-ai-agents-vulnerable-to-indirect-prompt-injection/
- https://arxiv.org/html/2603.10387v1

---

### 3. Malicious Skills / Plugin Supply Chain (ClawHub)
OpenClaw's skills marketplace is an unvetted open attack surface.

**Cisco's Skill Scanner findings on a single malicious skill:**
- 2 Critical, 5 High severity findings
- Silent `curl` exfiltrating data to external servers
- Embedded bash command injection
- Tool poisoning via malicious payload in skill files

NCC Group independently found "blatantly malicious skills that gave remote attackers command line access to the OpenClaw server."

**Sources:**
- https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare
- https://www.nccgroup.com/securing-agentic-ai-what-openclaw-gets-wrong-and-how-to-do-it-right/

---

### 4. Persistent Context Poisoning
Self-modifiable files (`SOUL`, `IDENTITY`, `USER`) allow threat actors to permanently alter the agent's behavior. Context poisoning via these files persists across all future sessions.

**Source:** https://www.giskard.ai/knowledge/openclaw-security-vulnerabilities-include-data-leakage-and-prompt-injection-risks

---

### 5. Credential Leakage
OpenClaw has been documented leaking plaintext API keys and credentials, stealable via prompt injection or unsecured endpoints.

**Source:** https://www.kaspersky.com/blog/openclaw-vulnerabilities-exposed/55263/

---

### 6. Root Architectural Admission
From OpenClaw's own documentation: *"There is no 'perfectly secure' setup."*

Multiple researchers converge on the same diagnosis: OpenClaw is **"an unstructured agentic system"** that *"lacks security levers to manage trusted and untrusted data, functions, and state."*

**Source:** https://www.darkreading.com/application-security/openclaw-insecurities-safe-usage-difficult

---

## AM: Security Architecture Analysis

### Core Files Examined
- `agent/src/loop/invoke-claude.ts` — process spawn model
- `apps/board/src/worker/gates.ts` — gate verification worker
- `apps/board/src/app/api/cards/schema.ts` — Zod input validation
- `scripts/dispatcher.ts` — work.md composition + static prompts
- `CLAUDE.md` — design principles

### Key Security Properties

#### 1. Worktree Isolation
Every card gets its own git worktree with a dedicated branch. All agent file I/O is scoped to the worktree via `cwd: workDir` in `Bun.spawn()`. Concurrent agents cannot touch each other's files. Cleanup is deterministic.

#### 2. CLI-as-Gatekeeper
Agents cannot mutate board state directly — all process actions go through the `board` CLI, which routes to a REST API with Zod-validated schemas. No direct database access. Enum constraints prevent agents from injecting arbitrary state values.

#### 3. Server-Side Gate Verification
The gate worker (`gates.ts`) verifies transitions **server-side** before applying them. The agent cannot self-certify completion. Gates re-run `bun test`, re-read criteria files, and scan for `✓` markers in logs. Claims made by the agent are irrelevant — only evidence matters.

#### 4. Static, Immutable Prompts
Dispatched agents receive column prompts that are **hardcoded constants** in `dispatcher.ts`. No user-supplied string reaches the agent as an instruction. Card metadata (title, state, priority) is validated by Zod before interpolation into `work.md`.

#### 5. Stateless Agent Process
Each agent invocation is a new process with no conversation history. All state lives in files. Auth environment variables (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`) are stripped before spawn. `stdin: "ignore"` prevents interactive manipulation.

#### 6. Computed State Over Stored State
Iteration counts, priority order, and test status are derived at runtime — never cached. Cached derived state is a staleness attack surface; computing on demand eliminates it.

---

## Industry Context: Secure Agent Design Patterns

**Channel Separation (instruction vs. data)** — the principle OpenClaw violates: instruction channels (authenticated user commands) must be strictly separate from data channels (content retrieved from untrusted external sources).

**Orchestration tree / sub-agent isolation** (NCC Group) — control agents delegate to sub-agents with defined privilege levels. Sub-agents return only safe, deterministic datatypes.

**Plan-then-execute pattern** — agents formulate a fixed plan before acting. Untrusted tool output cannot inject instructions that deviate the plan.

**OWASP Structured Prompt Architecture** — explicit separation of system instructions from user/external data using marked sections.

**Sources:**
- https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- https://www.lakera.ai/blog/indirect-prompt-injection
- https://arxiv.org/html/2603.13151v1
- https://www.baytechconsulting.com/blog/build-corporate-ai-fortress-walled-gardens-2026
- https://www.akamai.com/blog/security/clawdbot-openclaw-practical-lessons-building-secure-agents
