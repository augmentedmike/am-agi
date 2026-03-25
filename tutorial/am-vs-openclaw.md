# AM vs. OpenClaw: Walled Garden vs. Open Wound

*A security architecture comparison*

---

## Introduction

The emergence of autonomous AI agents has produced two very different design philosophies. One treats security as an architectural foundation — every interaction mediated, every state transition verified, every trust boundary explicit. The other treats security as an afterthought, a disclaimer appended to docs that read: *"There is no 'perfectly secure' setup."*

This document contrasts AM — a walled-garden agent framework built with narrow, deterministic channels and server-side verification — against OpenClaw, an open-source autonomous agent whose gregarious insecurities have been documented by Oasis Security, NCC Group, Cisco, Kaspersky, and a growing collection of academic researchers.

The gap between these approaches is not a matter of feature parity. It is a matter of whether security is a property of the system or a responsibility of the user.

---

## OpenClaw: An Unstructured Agentic System

OpenClaw (formerly Clawdbot) is a self-hosted autonomous AI agent that can run shell commands, read and write files, process email, browse the web, and integrate with messaging platforms. It is widely used. It is also, by every independent security analysis conducted in 2025–2026, fundamentally unsafe for use with anything sensitive.

The root diagnosis, articulated by NCC Group, Cisco, Giskard, and arxiv researchers alike, is the same: OpenClaw is **"an unstructured agentic system"** that **"lacks security levers to manage trusted and untrusted data, functions, and state."** It combines untrusted inputs, autonomous action, plugin extensibility, and privileged system access inside a single execution loop with no trust boundaries.

---

## Documented Vulnerabilities

### 1. ClawJacked: WebSocket Hijack via Any Website

**Disclosed by:** Oasis Security, February 2026
**CVE severity:** Critical

Any website can silently hijack a running OpenClaw agent through its localhost WebSocket gateway. Browser cross-origin policies do not apply to localhost connections. OpenClaw's gateway also exempts localhost from rate-limiting, allowing a malicious page to brute-force authentication at hundreds of attempts per second. Local connections auto-approve device pairing without user confirmation.

From Oasis Security's disclosure:
> "Any website you visit can open one to your localhost...while you're browsing any website, JavaScript running on that page can silently open a connection to your local OpenClaw gateway."

Once authenticated, the attacker gains full agent control: AI responses, configuration, connected device list, conversation logs.

*Source: https://www.oasis.security/blog/openclaw-vulnerability*

---

### 2. Indirect Prompt Injection

OpenClaw reads emails, fetches web pages, and processes messages from external sources — and then acts on them. It makes no architectural distinction between *instructions* (commands from the authenticated user) and *data* (content retrieved from untrusted sources). This is the original sin of agentic AI design.

Demonstrated attack: an attacker emails a crafted prompt-injection payload to an inbox monitored by OpenClaw. The agent retrieves the email, interprets the embedded instructions, locates a private key on the filesystem, and exfiltrates it — all without user interaction. The same attack works via Google Docs, Slack messages, and arbitrary web pages.

Researchers tested defense rates across LLM backends and found values ranging from 17% (DeepSeek) to 83% (Claude). None of these numbers are acceptable for a system with shell access.

*Source: https://thehackernews.com/2026/03/openclaw-ai-agent-flaws-could-enable.html*
*Source: https://arxiv.org/html/2603.10387v1*

---

### 3. Malicious Skills and Plugin Supply Chain

OpenClaw's ClawHub skills marketplace accepts community-submitted plugins with no meaningful security vetting. Cisco's Skill Scanner analyzed a single malicious skill and found 2 Critical and 5 High severity findings: silent `curl` commands exfiltrating data to external servers, embedded bash command injection, and tool poisoning via malicious payloads in skill configuration files.

NCC Group independently found skills in the marketplace that gave remote attackers direct command-line access to the OpenClaw server. The attack surface is the size of the internet.

*Source: https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare*

---

### 4. Persistent Context Poisoning

OpenClaw maintains self-modifiable files (`SOUL`, `IDENTITY`, `USER`) that persist across sessions and are loaded into the model's context at startup. A single successful prompt injection that reaches these files can permanently alter the agent's behavior — changing its personality, its goals, its instructions — for all future sessions.

There is no rollback mechanism. There is no integrity check. The agent is its own attack surface.

*Source: https://www.giskard.ai/knowledge/openclaw-security-vulnerabilities-include-data-leakage-and-prompt-injection-risks*

---

### 5. Credential Leakage

OpenClaw has been documented leaking plaintext API keys and authentication credentials through unsecured endpoints and ambient context. Once prompt injection is possible, any secrets in the agent's environment are accessible. There is no secrets isolation.

*Source: https://www.kaspersky.com/blog/openclaw-vulnerabilities-exposed/55263/*

---

## AM: Security as Architecture

AM's design does not attempt to patch the problems that plague OpenClaw. It prevents the conditions that make those problems possible.

### 1. No Ambient Trust: CLI-as-Gatekeeper

In AM, agents cannot mutate system state directly. Every workflow action routes through a deterministic CLI (`board`), which routes to a REST API that validates all inputs with Zod schemas and enforces enum constraints. Agents have no direct database access, no direct filesystem access to board state, no ability to forge state transitions.

An agent that claims "work is done" cannot simply mark a card shipped. The claim is irrelevant. What matters is what the gate worker finds when it looks.

This is the inverse of OpenClaw, where the agent's outputs *are* the state — where a sufficiently clever prompt injection can instruct the agent to report success, update its own context files, and proceed unchecked.

**Contrast:** OpenClaw has no gatekeeper. Any instruction in any data source can redirect agent behavior. AM has no instruction surface in data sources at all.

---

### 2. Server-Side Gate Verification: Agents Cannot Self-Certify

Before any state transition, AM's gate worker (`apps/board/src/worker/gates.ts`) runs server-side verifications that the agent cannot influence:

- `bun test` is re-executed to verify tests actually pass — not because the agent says they do
- `iter/<n>/agent.log` is scanned for `✓` markers corresponding to each criterion
- `criteria.md` is checked for the presence of numbered items
- `todo.md` is inspected for unchecked items (`- [ ]`)

The agent's claims are not inputs to these checks. If an agent writes "all tests pass" in its log but the test suite exits non-zero, the gate rejects the transition. No amount of confident assertion changes this.

**Contrast:** OpenClaw has no gate worker. An agent that is prompted (or injected) to claim success can proceed to any action. The agent is judge in its own case.

---

### 3. Worktree Isolation: Process and Filesystem Boundaries

Every AM task gets its own git worktree with a dedicated branch. All agent file I/O is scoped to that worktree via `cwd: workDir` in the process spawn call. Concurrent agents cannot access each other's state. The `stdin: "ignore"` option prevents any interactive manipulation of the agent process.

The agent process also runs with auth environment variables stripped (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`), preventing nested session auth hijacking.

**Contrast:** OpenClaw's ClawJacked vulnerability exists precisely because there are no process boundaries — the agent's WebSocket gateway is accessible to any JavaScript on any page the user visits. AM's agent process has no inbound network surface.

---

### 4. Static, Immutable Prompts: No Injection Surface

In AM, the prompts dispatched to agents are hardcoded constants in `scripts/dispatcher.ts`. They are not derived from user input, card content, or external sources. Card metadata (title, state, priority) is interpolated into `work.md` as plain text after Zod validation — it is presented to the agent as data context, not as executable instructions.

The `work.md` file contains:
```
# Card: <title> (<id>)
State: <state>
Priority: <priority>

## Instructions
<HARDCODED COLUMN PROMPT>
```

The column prompt is a static string. An attacker who controls a card's title cannot inject executable instructions into the agent's context — the title appears in a data position, not an instruction position.

**Contrast:** OpenClaw reads emails, web pages, and Slack messages and treats their content as potential instructions. There is no data/instruction separation. A sufficiently crafted message can redirect any OpenClaw agent.

---

### 5. Stateless Agent Process: No Persistent Poisoning

AM agents have no memory between invocations. Each iteration is a fresh process. All state lives in files (`work.md`, `criteria.md`, `todo.md`, `iter/*/agent.log`) that are read explicitly at the start of each run. There are no self-modifying personality files, no persistent context stores, no "learned" behaviors.

An attacker who successfully injects into one AM agent iteration can influence that iteration only. The next iteration starts clean, re-reading from trusted files. Persistent poisoning — the attack vector that allows OpenClaw's `SOUL` and `IDENTITY` files to be weaponized — is architecturally impossible.

**Contrast:** OpenClaw's context persistence across sessions is both a feature and a critical vulnerability. AM's statelessness is a security property.

---

### 6. Computed State Over Stored State

AM derives dynamic values at runtime rather than caching them. Iteration counts come from counting `iter/` directories. Priority order is computed from enum values. Test status is the live exit code of `bun test`, not a cached boolean.

This matters for security because stored derived state can be manipulated. A cached "tests passed" flag can be poisoned. A computed "tests pass" check cannot be — it re-runs the tests every time.

**Contrast:** OpenClaw's self-modifiable files *are* stored derived state. Its security posture depends on those files not being tampered with. They can be tampered with.

---

## Comparison Summary

| Dimension | AM | OpenClaw |
|---|---|---|
| **Trust model** | No claims trusted; server verifies | Agent output determines state |
| **Prompt injection surface** | None (static prompts, data/instruction separation) | Any email, webpage, document, or message |
| **Process isolation** | Worktree per task, `stdin: ignore`, stripped env | Shared process, network-accessible gateway |
| **State persistence** | Stateless process; files are source of truth | Self-modifying context files (`SOUL`, `IDENTITY`) |
| **Plugin surface** | No plugin system | Open marketplace (ClawHub), no vetting |
| **Gate enforcement** | Server-side, re-runs tests, reads files | None |
| **Credential exposure** | Auth env vars stripped before spawn | Ambient credentials accessible to injection |
| **Security philosophy** | Built in, not bolted on | "No perfectly secure setup" |

---

## Trade-Offs and Honest Limitations

AM's walled-garden model is not free of costs.

**Narrowness as a constraint.** AM agents can only do what the board CLI, git, and bun allow. An OpenClaw agent can connect to arbitrary APIs, send emails, scrape the web, and execute arbitrary shell commands. AM's security comes from precisely this narrowness — but it means AM cannot do everything OpenClaw can do. This is a feature, not a bug.

**Gate rigidity.** The gate worker's checks are deterministic and binary. A valid task that happens to produce an unusual output format can get stuck. Escaping a rejected transition requires either fixing the underlying issue or updating the gate definition — there is no override.

**Single-machine trust boundary.** AM's security model assumes the board server, the agent process, and the worktree are all on trusted hardware. It does not defend against a compromised host — but neither does any agent framework. The threat model is: untrusted data from external sources should not be able to direct agent behavior. AM satisfies this. OpenClaw does not.

---

## Conclusion

The fundamental difference between AM and OpenClaw is not a feature list. It is an architectural commitment.

OpenClaw chose maximum capability and openness — any tool, any input, any plugin. Security became the user's problem, documented in disclaimers rather than enforced by the system. The results are visible in a cascade of CVEs, research papers, and public disclosures.

AM chose narrow, deterministic, verifiable channels. Agents can only do what the CLI allows. State transitions can only occur when the gate independently verifies they are valid. Prompts are code, not user data. No instruction surface exists in untrusted input because untrusted input is never in an instruction position.

The walled garden is not a prison. It is a design choice about where trust belongs: in the architecture, not in the hope that nothing bad will be in an email.

---

## References

1. Oasis Security — ClawJacked: OpenClaw Vulnerability Enables Full Agent Takeover
   https://www.oasis.security/blog/openclaw-vulnerability

2. The Hacker News — ClawJacked Flaw Lets Malicious Sites Hijack Local OpenClaw AI Agents via WebSocket
   https://thehackernews.com/2026/02/clawjacked-flaw-lets-malicious-sites.html

3. The Hacker News — OpenClaw AI Agent Flaws Could Enable Prompt Injection and Data Exfiltration
   https://thehackernews.com/2026/03/openclaw-ai-agent-flaws-could-enable.html

4. Cisco Blogs — Personal AI Agents like OpenClaw Are a Security Nightmare
   https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare

5. NCC Group — Securing Agentic AI: What OpenClaw Gets Wrong and How to Do It Right
   https://www.nccgroup.com/securing-agentic-ai-what-openclaw-gets-wrong-and-how-to-do-it-right/

6. Giskard — OpenClaw security issues include data leakage & prompt injection
   https://www.giskard.ai/knowledge/openclaw-security-vulnerabilities-include-data-leakage-and-prompt-injection-risks

7. Kaspersky — New OpenClaw AI agent found unsafe for use
   https://www.kaspersky.com/blog/openclaw-vulnerabilities-exposed/55263/

8. arXiv — Don't Let the Claw Grip Your Hand: A Security Analysis and Defense Framework for OpenClaw
   https://arxiv.org/html/2603.10387v1

9. arXiv — Defensible Design for OpenClaw: Securing Autonomous Tool-Invoking Agents
   https://arxiv.org/html/2603.13151v1

10. Dark Reading — OpenClaw's Gregarious Insecurities Make Safe Usage Difficult
    https://www.darkreading.com/application-security/openclaw-insecurities-safe-usage-difficult

11. OWASP — LLM Prompt Injection Prevention Cheat Sheet
    https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
