# AM Integration Strategy — Research Document

**Date:** 2026-03-30
**Purpose:** Define the integration architecture for AM across all project types.
**Status:** Historical research — written when AM was positioned for 6-function SMB use. AM is now focused as an **engineering and AI specialist agent runtime**. Integration work outside engineering/AI tooling (e.g., CRM, sales sequences, support ticketing) is out of scope for the current product. Retained as reference for the integration architecture patterns (email-as-fallback, webhook middleware), which remain valid design principles.

This is a product decision document — it should produce actionable engineering priorities, not a survey of options.

---

## Core Thesis

AM connects to the systems users already live in. The integration strategy determines how much engineering effort is required per new project type, and how reliable those connections are in production. The wrong architecture creates a maintenance tax that compounds with every new tool supported. The right one creates a platform effect where each new integration makes AM more useful without proportional engineering cost.

Three principles apply throughout:

1. **Email is the universal fallback.** Almost every business tool sends email notifications and accepts email replies. IMAP/SMTP coverage is broader than any API portfolio.
2. **Zapier/Make as the long tail.** For tools without native integrations, webhook middleware covers thousands of apps with a single receiver endpoint.
3. **Build native APIs only where email/webhooks cannot do the job.** Native integrations are expensive to build, maintain, and auth. Reserve them for high-volume or bidirectional workflows where latency or data fidelity matters.

---

## Per-Type Integration Needs

---

### 1. Sales Outbound

**What AM needs to read (inbound)**
- Contact records: name, title, company, email, phone, recent activity
- Sequence enrollment status and reply detection
- CRM deal stages and activity history
- Bounce and unsubscribe events
- Intent signals (site visits, content downloads) if available

**What AM needs to do (outbound)**
- Enroll contacts in sequences or campaigns
- Log activities (calls, meetings, notes) back to CRM
- Update deal stages
- Create and update contact/company records
- Pause or stop sequences on reply or out-of-office detection
- Draft and send personalized outbound emails

**Best integration path**

Native API for the primary CRM (HubSpot or Salesforce) and the primary sequencer (Apollo or Instantly). These are the two axes of outbound: where records live and where sequences run. Email IMAP/SMTP handles reply detection and manual outreach workflows. Zapier/Make handles the long tail (e.g., enrichment tools like Clay, Clearbit).

HubSpot is the right first native integration — it covers CRM + sequences in one API, has excellent OAuth, and dominates the engineering and startup market where AM's early users will be. Apollo second, because it is the dominant sequencer for outbound-heavy teams and has a well-documented REST API.

Salesforce is important but complex — treat it as a Zapier-first integration initially, then build native when enterprise demand justifies it.

**Specific tools to support first**
- HubSpot (native API — contacts, deals, sequences, activities)
- Apollo.io (native API — sequences, contact enrollment, reply detection)
- Instantly (native API — campaign management, reply webhooks)
- Salesforce (Zapier/Make first, native later)
- Outreach (Zapier/Make — complex API, lower initial priority)

---

### 2. Customer Support

**What AM needs to read (inbound)**
- New tickets and conversations (subject, body, requester, priority, tags)
- Conversation history and prior resolutions
- Customer metadata (plan, account health, prior contact)
- SLA status and escalation flags

**What AM needs to do (outbound)**
- Draft and send replies
- Assign, tag, and prioritize tickets
- Escalate to human agents with context
- Log resolutions and close tickets
- Create Linear or Jira issues from bug reports
- Look up internal knowledge base articles

**Best integration path**

Native API for the primary support platform. Support tools have rich APIs and webhook event systems — this is one of the few categories where webhooks (tool pushes event to AM) are the right primary mechanism. AM registers a webhook URL, receives new conversation events, processes them, and calls the API to respond.

Intercom and Zendesk both have mature webhook + API surfaces. Help Scout and Front are simpler but still have usable APIs. Linear for bug report creation is a clean native API.

Email fallback works but loses structured metadata (tags, priority, assignee). Use IMAP only for tools without API access.

**Specific tools to support first**
- Intercom (native API + webhooks — conversations, contacts, notes, assignments)
- Zendesk (native API + webhooks — tickets, comments, user data)
- Linear (native API — issue creation from bug reports, label assignment)
- Help Scout (native API — conversations, mailboxes)
- Front (Zapier/Make — shared inbox model, lower initial priority)

---

### 3. Customer Success

**What AM needs to read (inbound)**
- Account health scores and risk flags
- Product usage metrics (logins, feature adoption, MAU)
- Renewal dates, contract values, expansion opportunities
- Support ticket volume and sentiment per account
- QBR and check-in history

**What AM needs to do (outbound)**
- Draft proactive outreach (renewal reminders, health check emails)
- Log touchpoints to CRM
- Flag at-risk accounts for CSM review
- Update health scores or notes
- Schedule EBRs or check-ins

**Best integration path**

Customer success is data-heavy but action-light. The primary need is reading health and usage data and sending outreach. HubSpot or Salesforce as the CRM of record covers most of the action layer via the same native integrations built for Sales. Gainsight and ChurnZero have APIs but are complex enterprise tools — Zapier/Make is the right path initially.

Email is especially important here because much of customer success work is personal outreach via email, not automated sequences. IMAP/SMTP for sending and tracking replies is a core capability.

**Specific tools to support first**
- HubSpot (same native integration as Sales — contacts, deals, activities)
- Salesforce (Zapier/Make first)
- Gainsight (Zapier/Make — complex platform, niche enough to defer native)
- ChurnZero (Zapier/Make — webhook support for health score changes)
- Email/SMTP (native — personal outreach and reply tracking)

---

### 4. Hiring

**What AM needs to read (inbound)**
- Open job requisitions and descriptions
- Candidate profiles (name, resume, stage, notes, interview feedback)
- Stage transitions and rejection reasons
- Scheduled interviews and panel assignments
- Sourcing pipeline status

**What AM needs to do (outbound)**
- Move candidates between stages
- Send outreach to candidates (sourcing, scheduling, status updates)
- Log interview notes and scorecards
- Post job openings (to job boards via ATS integrations)
- Schedule interviews via calendar integration

**Best integration path**

ATS platforms (Ashby, Greenhouse, Lever) all have solid REST APIs and webhook support. This is another webhook-primary category — stage changes and new applications push to AM, which then acts. Email is critical because candidate communication is almost always email-based and must feel personal, not automated.

Ashby is the right first native integration — it is the dominant ATS for high-growth startups and has the best developer experience of the group. Greenhouse second for mid-market. Lever and Workable via Zapier/Make initially.

Google Calendar or Outlook Calendar integration matters here for interview scheduling — this is shared with other project types and worth building as a standalone integration.

**Specific tools to support first**
- Ashby (native API + webhooks — candidates, jobs, stage transitions, scorecards)
- Greenhouse (native API + webhooks — applications, interviews, offers)
- Email/SMTP (native — candidate outreach and scheduling)
- Lever (Zapier/Make — solid but lower priority)
- Workable (Zapier/Make)
- Google Calendar (native OAuth — interview scheduling, shared across types)

---

### 5. PR / Outreach

**What AM needs to read (inbound)**
- Journalist and influencer contact lists with beats and recent coverage
- Press release drafts and approved messaging
- Media pickup alerts and coverage tracking
- Pitch history and response tracking

**What AM needs to do (outbound)**
- Draft and send personalized media pitches
- Track replies and follow up
- Log coverage hits
- Monitor brand mentions (via search or monitoring tools)

**Best integration path**

PR is the most email-native of all project types. Muck Rack and Cision are expensive enterprise platforms — their APIs are gated, limited, and not worth building against for a first release. The real workflow is: maintain a contact list, draft pitches, send personalized emails, track replies.

IMAP/SMTP as the primary integration path. AM manages the pitch workflow over email, with contact lists stored in AM itself or imported from CSV/HubSpot. Muck Rack and Cision via Zapier/Make for teams that have them.

Google Alerts or similar monitoring can be piped in via RSS or email digest — no API needed.

**Specific tools to support first**
- Email/SMTP (native — this IS the PR workflow for most teams)
- HubSpot (reuse Sales integration for contact management)
- Muck Rack (Zapier/Make — if user has access)
- Cision (Zapier/Make — enterprise only, low priority)
- RSS/Google Alerts (native RSS parsing for coverage monitoring)

---

### 6. Partnerships

**What AM needs to read (inbound)**
- Partner contact records and deal stages
- Co-sell and referral pipeline activity
- Crossbeam account overlap data
- Partner agreement status and renewal dates
- Inbound partner inquiries via email

**What AM needs to do (outbound)**
- Draft and send partner outreach and follow-ups
- Log partnership activities to CRM
- Update deal stages for partner-sourced or co-sold opportunities
- Share relevant collateral or introductions

**Best integration path**

Partnerships is almost entirely email-based. Like PR, the workflow is relationship-driven — personal email, not automated sequences. HubSpot or Salesforce for CRM (reuse existing integration). Crossbeam has a limited API and is better handled via Zapier/Make or CSV export initially.

The key insight here: partnerships teams rarely want automation to send emails on their behalf without review. AM's role is drafting, tracking, and surfacing — not firing off autonomous outreach. The integration surface is lighter as a result.

**Specific tools to support first**
- Email/SMTP (native — core workflow)
- HubSpot (reuse Sales integration — deals, contacts, activities)
- Crossbeam (Zapier/Make — overlap reports, partner signals)
- Salesforce (Zapier/Make — partner pipeline tracking)

---

### 7. Content Marketing

**What AM needs to read (inbound)**
- Content calendar and draft status
- Published post metadata (URL, publish date, performance metrics)
- Brand guidelines and approved messaging
- SEO targets and keyword priorities
- Social media performance data

**What AM needs to do (outbound)**
- Publish or schedule posts to CMS
- Schedule social media posts
- Update content calendar
- Generate drafts for human review
- Pull performance reports

**Best integration path**

CMS platforms split into two tiers. Ghost and WordPress have excellent REST APIs — native integration is the right call. Contentful and Webflow have strong APIs too. The pattern is: AM drafts content, pushes to CMS draft status, human approves and publishes (or AM publishes on schedule).

Social scheduling via Buffer or Hootsuite is well-suited to native API. Both have content APIs for scheduling posts. For other social tools, Zapier/Make covers the gap.

**Specific tools to support first**
- Ghost (native API — post creation, draft management, publish scheduling)
- WordPress (native REST API — posts, categories, media upload)
- Contentful (native API — entries, assets, publish workflow)
- Buffer (native API — post scheduling across social channels)
- Webflow (native API — CMS items, publish)
- Hootsuite (Zapier/Make — complex auth, lower priority)

---

### 8. Knowledge Base

**What AM needs to read (inbound)**
- Existing articles and their structure/hierarchy
- Out-of-date or missing content (flagged by support volume or search data)
- Draft and review status of articles

**What AM needs to do (outbound)**
- Create and update articles
- Reorganize content structure
- Flag articles for human review
- Sync documentation with product changes

**Best integration path**

Knowledge base platforms are content APIs — reading and writing structured documents. Notion has a well-documented API. Confluence has a REST API. GitBook and Mintlify have APIs but smaller user bases.

The key workflow: AM identifies gaps or outdated content (triggered by support tickets, product updates, or scheduled review), drafts updates, and puts them in draft/review state. Human approves.

Notion is the right first integration because it doubles as the knowledge base AND the ops tool for many small teams (covering the Operations project type too). This means the Notion integration has leverage across multiple project types.

**Specific tools to support first**
- Notion (native API — pages, databases, blocks, comments)
- Confluence (native API — spaces, pages, attachments)
- GitBook (native API — spaces, pages, content sync)
- Mintlify (Zapier/Make or GitHub-based — docs-as-code workflow, low API surface)

---

### 9. Community

**What AM needs to read (inbound)**
- New member joins and introductions
- Questions and unanswered threads
- Spam and policy violations
- Engagement metrics (active members, post volume, churn)
- DMs and mentions directed at the community bot

**What AM needs to do (outbound)**
- Welcome new members
- Answer common questions
- Flag issues for human moderators
- Post announcements and scheduled content
- Summarize activity for weekly digests

**Best integration path**

Discord and Slack both have bot APIs — this is a real-time event-driven category that requires persistent bot connections (WebSocket), not REST polling. This is the most architecturally different category from the rest. Building a bot means maintaining a long-running process that responds to events.

Circle is REST API based and more similar to other platforms. For Circle, webhook + API is the right approach.

Community management is high-value but the bot infrastructure requirement makes it a meaningful engineering lift. Discord and Slack bots should be scoped as a dedicated subsystem, not folded into the general integration framework.

**Specific tools to support first**
- Discord (native bot API — gateway events, message create, member join, moderation)
- Slack (native bot API — Events API, slash commands, block kit messages)
- Circle (native API + webhooks — members, posts, events, spaces)

---

### 10. Operations

**What AM needs to read (inbound)**
- Project and task status across tools
- Blocked items and overdue tasks
- Sprint or cycle health
- Meeting notes and action items
- OKR progress and initiative status

**What AM needs to do (outbound)**
- Create and update issues/tasks
- Assign work and update status
- Write and update documentation
- Summarize project status
- Identify and surface blockers

**Best integration path**

Linear and Jira are issue trackers with strong REST APIs and webhook event support. Notion covers docs and databases. Airtable has a solid API for structured data. These are all worth native integrations given their centrality to daily operations.

Linear is the right first integration here — it is dominant in the same startup and high-growth segment that AM targets, has an excellent GraphQL API, and is the tool most likely to be the operational hub for AM's early users.

Airtable is worth early attention because many teams use it as a lightweight database for processes that don't fit cleanly into a project tracker.

**Specific tools to support first**
- Linear (native GraphQL API — issues, projects, cycles, labels, comments)
- Notion (same integration as Knowledge Base — databases, pages, tasks)
- Jira (native API + webhooks — issues, sprints, boards, transitions)
- Airtable (native API — bases, tables, records, views)

---

## Integration Architecture Options

### Option A: Direct API (native per-tool integrations)

Each tool gets a purpose-built integration: OAuth app, token storage, API client, webhook receiver. AM calls the tool's API directly.

**Strengths**
- Maximum data fidelity — access to every field and event the tool exposes
- Low latency — real-time event handling
- No dependency on third-party middleware
- Better auth UX (OAuth popup in onboarding)

**Weaknesses**
- High engineering cost per integration (auth, client, error handling, API version drift)
- Every new tool is a new project
- OAuth credentials require per-tool developer app registration
- API rate limits and pagination must be handled per tool

**When to use:** Tools that are central to AM's core workflows, used by the majority of users, and where email/webhook coverage is insufficient (e.g., need to read structured data like CRM records or ATS candidates).

---

### Option B: Email as universal interface (IMAP in, SMTP out)

AM connects to the user's email account via IMAP for reading and SMTP for sending. Most tools send email notifications; AM reads them and acts. Outbound actions happen via email.

**Strengths**
- Universal — every tool sends email
- One integration covers hundreds of tools
- Familiar UX for users (review AM drafts before send)
- No per-tool OAuth to build or maintain
- Already partially built (AM has IMAP via imapflow)

**Weaknesses**
- Email is noisy — requires good filtering and parsing logic
- Latency depends on email delivery (seconds to minutes)
- Structured data is lost — AM gets email text, not API objects
- Outbound is limited to what email can do (can't update CRM stages via email alone)
- Reply tracking requires careful threading logic

**When to use:** Project types that are inherently email-based (PR, Partnerships), tools without good APIs, early-stage coverage before native integrations are built, and as a fallback for any tool in any category.

---

### Option C: Zapier / Make as middleware

The user connects their tools to Zapier or Make. AM exposes a webhook receiver endpoint. Zapier/Make sends events to AM and optionally receives action payloads back via webhook or API call.

**Strengths**
- 5000+ apps available with no AM engineering work
- Handles OAuth for each tool — AM never touches user credentials
- Flexible event routing — users can customize what triggers AM
- Zapier's "Send Webhook" and "Catch Hook" cover bidirectional flows

**Weaknesses**
- User must set up Zapier/Make flows — additional setup friction
- Latency (Zapier free tier polls every 15 minutes; paid is near real-time)
- AM cannot initiate actions without Zapier/Make in the loop
- Data structure is whatever Zapier normalizes — may lose fidelity
- Cost: Zapier/Make adds a user subscription cost on top of AM
- Not suitable for high-frequency or latency-sensitive workflows

**When to use:** Long-tail tools that few users need, enterprise tools with complex APIs (Salesforce, Gainsight), tools where AM's action surface is small (just receive an event, draft a response), and as a bridge while native integrations are being built.

---

### Option D: Webhook receivers (tool pushes to AM)

The tool sends event webhooks to an AM endpoint. AM processes the event and calls back via the tool's API. This is a subset of native API integration but worth naming separately because it shifts the trigger direction.

**Strengths**
- Real-time — events arrive as they happen
- No polling required
- Reduces AM's need to maintain persistent connections

**Weaknesses**
- Still requires the tool's API for outbound actions
- Requires AM to be publicly reachable (HTTPS endpoint with a real domain)
- Webhook reliability varies by tool (retry logic, secret validation)

**When to use:** Support tools (Intercom, Zendesk), ATS platforms (Ashby, Greenhouse), anywhere that real-time event handling matters and AM is taking action in response to something happening.

---

### Recommendation

**Build the integration layer in three tiers:**

**Tier 1 — Native API (build these first, high leverage)**

These tools are used by a majority of AM's target users and require structured data access that email cannot provide:

- HubSpot (covers Sales, CS, Partnerships — one integration, three project types)
- Email/IMAP+SMTP (covers PR, Partnerships, Hiring outreach, CS outreach)
- Linear (covers Operations, Support escalation)
- Notion (covers Knowledge Base, Operations)
- Ashby (covers Hiring)
- Intercom or Zendesk (covers Support — pick one to build first, Intercom for PLG users)
- Ghost or WordPress (covers Content)

These eight integrations cover the primary tool in every project type.

**Tier 2 — Zapier/Make webhook middleware (build the receiver, let Zapier handle the tools)**

AM exposes a single inbound webhook endpoint with a documented payload schema. Users who need Salesforce, Greenhouse, Lever, Jira, Confluence, Gainsight, ChurnZero, Cision, or any other tool connect them via Zapier/Make. AM also exposes an action API so Zapier/Make can trigger AM actions.

This costs roughly one engineering sprint to build the receiver and document the schema — then it covers thousands of tools.

**Tier 3 — Community bots (separate subsystem)**

Discord and Slack bots require a persistent WebSocket connection — architecturally different from REST integrations. Scope this as a separate subsystem with its own process, not part of the main integration layer. Build after Tier 1 and Tier 2 are stable.

**The right architecture for a small team:** Build email and Zapier/Make first — this gets AM to production for every project type with minimal engineering. Then layer in native APIs for the highest-leverage tools (HubSpot, Linear, Notion) as user demand validates the priority. Never build a native integration before there is clear user demand for it.

---

## What to Ask During Onboarding Per Project Type

---

### Sales Outbound

- Primary CRM: HubSpot / Salesforce / Other (if HubSpot: OAuth; if Salesforce: OAuth or API token + instance URL)
- Sequencer: Apollo / Instantly / Outreach / None (API key for each)
- Connected email address for outreach (SMTP credentials or Google/Outlook OAuth)
- Company name and domain (for personalization and signature)
- Ideal customer profile (industry, company size, title targets) — free text or structured fields
- Tone/voice preference: formal, casual, direct
- Sequences to enroll new leads in (select from existing, or create new)

---

### Customer Support

- Support platform: Intercom / Zendesk / Help Scout / Front / Other
  - If Intercom: OAuth
  - If Zendesk: subdomain + API token
  - If Help Scout: API key
- Bug tracker: Linear / Jira / None (API key or OAuth)
- Response tone: professional, friendly, technical
- Escalation rules: what triggers handoff to human (keywords, sentiment, account tier)
- SLA targets by priority level
- Knowledge base location (Notion / Confluence / URL — for AM to reference when drafting answers)

---

### Customer Success

- CRM: HubSpot / Salesforce / Other (reuse Sales credentials if already connected)
- Health score source: Gainsight / ChurnZero / manual / product analytics (Mixpanel, Amplitude)
  - If Zapier/Make: webhook URL from AM to configure
- Renewal date field name in CRM
- At-risk threshold (health score below X, or no login in Y days)
- Outreach email account (SMTP or OAuth)
- CSM assignment: how accounts are assigned to team members (field name in CRM)

---

### Hiring

- ATS: Ashby / Greenhouse / Lever / Workable / None
  - If Ashby: API key + organization ID
  - If Greenhouse: API key + on-behalf-of user email
- Email account for candidate outreach (SMTP or OAuth — must match recruiter's real address)
- Google Calendar or Outlook for interview scheduling (OAuth)
- Stages used in their pipeline (AM reads from ATS but confirm which are active)
- Email signature for recruiter outreach
- Screening criteria per role (optional — structured or free text)

---

### PR / Outreach

- Primary email account for media outreach (SMTP or Google/Outlook OAuth)
- Media contact list: Muck Rack / Cision / CSV upload / HubSpot
  - If Muck Rack: API key (if available on their plan)
  - If CSV: upload field with required columns (name, email, outlet, beat)
- Brand/product description for pitch context (free text)
- Approved spokesperson name and title
- Embargo or timing constraints (free text or date field)
- Coverage tracking: where to log hits (HubSpot / Notion / spreadsheet)

---

### Partnerships

- Email account for partner outreach (SMTP or OAuth)
- CRM for partner pipeline: HubSpot / Salesforce / None (reuse if connected)
- Crossbeam: API key (optional — for account overlap data)
- Partner types AM should handle: technology, channel, referral, co-sell
- Approval required before sending outreach: yes / no
- Partner agreement tracking: CRM field or Notion database (URL or field name)

---

### Content Marketing

- Primary CMS: Ghost / WordPress / Contentful / Webflow / Other
  - If Ghost: Admin API key + site URL
  - If WordPress: application password + site URL
  - If Contentful: space ID + management token
  - If Webflow: site ID + API token
- Social scheduler: Buffer / Hootsuite / None
  - If Buffer: OAuth
- Brand voice document: URL or paste (Notion page, Google Doc link, or free text)
- Content calendar location: Notion / Airtable / other (URL or API credentials)
- Publish workflow: AM drafts only / AM drafts + schedules / AM publishes directly
- SEO tool: Ahrefs / Semrush / None (API key if available — for keyword data)

---

### Knowledge Base

- Platform: Notion / Confluence / GitBook / Mintlify / Other
  - If Notion: OAuth (workspace-level)
  - If Confluence: cloud URL + API token + email
  - If GitBook: API token + space ID
- Linked support platform (to identify documentation gaps from ticket volume — reuse Support credentials)
- Documentation owner for review and approval (name + email)
- Update trigger: scheduled review / product release / support ticket spike / manual

---

### Community

- Platform: Discord / Slack / Circle / Other
  - If Discord: bot token + server ID + channel IDs
  - If Slack: OAuth (workspace-level bot install)
  - If Circle: API key + community ID
- Welcome message template (free text or choose from defaults)
- Moderation rules: what content triggers review or removal (free text or keyword list)
- Weekly digest: enabled / disabled, send to (channel or email)
- Human escalation channel: where AM should ping moderators when intervention is needed

---

### Operations

- Primary tracker: Linear / Jira / Notion / Airtable / Other
  - If Linear: API key + team ID
  - If Jira: cloud URL + API token + email
  - If Notion: OAuth (reuse if connected)
  - If Airtable: API key + base ID
- Meeting notes source: Notion / Google Docs / other (URL or OAuth)
- OKR tracking location: same tracker or separate tool
- Reporting cadence: daily / weekly / sprint-based
- Team members and their roles (for task assignment — import from tracker or manual list)

---

## Appendix: Integration Priority Matrix

| Project Type | First Native | Email Coverage | Zapier/Make Fallback |
|---|---|---|---|
| Sales Outbound | HubSpot, Apollo | Partial | Salesforce, Outreach |
| Customer Support | Intercom, Linear | Partial | Front, Zendesk (secondary) |
| Customer Success | HubSpot | Strong | Gainsight, ChurnZero |
| Hiring | Ashby | Strong | Lever, Workable |
| PR / Outreach | Email (primary) | Full | Muck Rack, Cision |
| Partnerships | Email (primary) | Full | Crossbeam |
| Content Marketing | Ghost, Buffer | Weak | Hootsuite, other CMS |
| Knowledge Base | Notion | Weak | Confluence, GitBook |
| Community | Discord, Slack | None | Circle |
| Operations | Linear, Notion | Weak | Jira, Airtable |

Email coverage is "full" where the workflow is inherently email-based, "strong" where email notifications carry enough signal for AM to act usefully, "partial" where structured data is sometimes needed, and "weak" where the primary workflow requires API access to structured records or real-time events.

---

*End of document.*
