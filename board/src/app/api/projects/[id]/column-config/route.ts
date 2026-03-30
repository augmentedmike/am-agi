import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getProject } from '@/db/projects';
import { getSetting, setSetting } from '@/db/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ColumnConfig = {
  prompt: string;       // Agent instructions for work in this state
  before_hook: string;  // Shell script: gate check — exits non-zero to block transition in
  after_hook: string;   // Shell script: runs after card enters this state
};

export type ProjectColumnConfig = {
  backlog: ColumnConfig;
  'in-progress': ColumnConfig;
  'in-review': ColumnConfig;
  shipped: ColumnConfig;
};

// Template-aware defaults
const TEMPLATE_DEFAULTS: Record<string, ProjectColumnConfig> = {
  'sales-outbound': {
    backlog: {
      prompt: 'Research the lead. Gather contact info, company background, pain points, and budget signals. Qualify against the ICP before moving forward.',
      before_hook: '#!/bin/bash\n# Block transition if no contact info logged\n[ -n "$(board show $CARD_ID | grep -i email)" ] || { echo "No contact email found"; exit 1; }',
      after_hook: '',
    },
    'in-progress': {
      prompt: 'Reach out via email, phone, or LinkedIn. Log every interaction with date and outcome. Goal: get a discovery call or receive a clear no.',
      before_hook: '#!/bin/bash\n# Require ICP qualification notes\n[ -f "$WORK_DIR/docs/qualification.md" ] || { echo "qualification.md missing"; exit 1; }',
      after_hook: '',
    },
    'in-review': {
      prompt: 'Prepare and send a tailored proposal. Address their specific pain points. Follow up if no response within 3 business days.',
      before_hook: '#!/bin/bash\n# Require discovery call logged\n[ -f "$WORK_DIR/docs/discovery-notes.md" ] || { echo "discovery-notes.md missing"; exit 1; }',
      after_hook: '',
    },
    shipped: {
      prompt: 'Log the outcome: won or lost. If won: send contract, initiate onboarding. If lost: log reason for future pipeline learning.',
      before_hook: '#!/bin/bash\n# Require outcome documented\n[ -f "$WORK_DIR/docs/outcome.md" ] || { echo "outcome.md missing"; exit 1; }',
      after_hook: '#!/bin/bash\n# Log to CRM / update deal stage\necho "Deal closed: $CARD_TITLE" >> "$WORK_DIR/docs/closed.log"',
    },
  },
  'customer-support': {
    backlog: {
      prompt: 'Triage the ticket. Understand the issue, reproduce if possible, categorize by type and severity. Assign priority.',
      before_hook: '',
      after_hook: '#!/bin/bash\n# Auto-reply: ticket received\n# himalaya send --to "$TICKET_EMAIL" --subject "Re: $TICKET_SUBJECT" --body "We received your ticket and will respond shortly."',
    },
    'in-progress': {
      prompt: 'Investigate and resolve the issue. Keep the customer updated with progress. Log all steps taken.',
      before_hook: '#!/bin/bash\n# Require triage notes\n[ -f "$WORK_DIR/docs/triage.md" ] || { echo "triage.md missing"; exit 1; }',
      after_hook: '',
    },
    'in-review': {
      prompt: 'Send resolution or next steps to the customer. Await confirmation. Follow up if no response within 24 hours.',
      before_hook: '#!/bin/bash\n# Require resolution documented\n[ -f "$WORK_DIR/docs/resolution.md" ] || { echo "resolution.md missing"; exit 1; }',
      after_hook: '',
    },
    shipped: {
      prompt: 'Ticket resolved and confirmed by customer. Send closure summary. Update knowledge base if applicable.',
      before_hook: '',
      after_hook: '#!/bin/bash\n# Send closure email\n# himalaya send --to "$TICKET_EMAIL" --subject "Re: $TICKET_SUBJECT [RESOLVED]" --body "Your ticket has been resolved."',
    },
  },
  'content-marketing': {
    backlog: {
      prompt: `Script this video. Do the following in order:
1. Validate the idea — is there search demand or audience interest? Check keyword data, trending angles, competitor coverage.
2. Define the hook — the first 30 seconds must earn the watch. Write 2–3 hook options.
3. Write the full script — include intro hook, body sections with b-roll notes, transitions, and a clear CTA at the end.
4. Plan the thumbnail — describe the visual concept: text overlay, expression, colors, contrast. Save as thumbnail-concept.md.
5. List required b-roll shots — what footage or screen recordings are needed? Save as shot-list.md.
6. Write docs/script.md with the final script.

Exit criteria: docs/script.md exists, hook is written, shot list is ready.`,
      before_hook: '',
      after_hook: '',
    },
    'in-progress': {
      prompt: `Production: record and edit this video.
1. Confirm docs/script.md exists and is final before recording.
2. Record the main camera/screen content following the script.
3. Capture all b-roll shots from the shot list.
4. Edit: cut dead air, tighten pacing, add b-roll, sync audio, color grade.
5. Add captions/subtitles — required for short-form repurposing.
6. Create the thumbnail — follow the concept in thumbnail-concept.md. Export as docs/thumbnail.png.
7. Export final video file. Log its path in docs/assets.md.
8. Write docs/assets.md listing: video file path, thumbnail file path, captions file path, raw footage location.

Exit criteria: docs/assets.md exists with all file paths. Thumbnail is done. Captions are done.`,
      before_hook: '#!/bin/bash\n[ -f "$WORK_DIR/docs/script.md" ] || { echo "docs/script.md required before production"; exit 1; }',
      after_hook: '',
    },
    'in-review': {
      prompt: `Pre-publish checklist — verify everything before going live:
1. Watch the full video — check pacing, audio levels, caption accuracy, no jump cuts or errors.
2. Confirm thumbnail is compelling — high contrast, readable text, clear subject.
3. Write the YouTube metadata in docs/metadata.md:
   - Title: primary keyword near the front, under 60 characters, curiosity-driven
   - Description: first 150 chars must hook (shown in search); include keyword, timestamps, links
   - Tags: 5–10 relevant tags
   - Chapters: timestamps for each section
4. Upload to YouTube as UNLISTED. Verify rendering, thumbnail, captions are correct.
5. Add the YouTube URL to docs/metadata.md.
6. Mark READY in docs/metadata.md when everything checks out.

Exit criteria: docs/metadata.md exists, contains YouTube URL, and is marked READY.`,
      before_hook: '#!/bin/bash\n[ -f "$WORK_DIR/docs/assets.md" ] || { echo "docs/assets.md required — production not complete"; exit 1; }',
      after_hook: '',
    },
    shipped: {
      prompt: `Schedule and distribute.
1. Set the scheduled publish date and time — write it at the top of docs/schedule.md:
   - Format: SCHEDULED: YYYY-MM-DD HH:MM (timezone)
   - Platforms: list every platform this is going to (YouTube, TikTok, Instagram Reels, Shorts, LinkedIn, Twitter/X)
2. If not already public: set the YouTube video to SCHEDULED (not unlisted). Confirm the scheduled time.
3. Prepare short-form clips for distribution:
   - Identify 2–3 punchy 30–60 second moments from the script.
   - List clip timestamps in docs/schedule.md with target platform for each (Shorts ≤60s, Reels ≤90s, TikTok up to 3min).
4. Write all platform copy in docs/schedule.md:
   - YouTube description: final version with links, timestamps, CTA
   - Twitter/X: hook tweet + thread of 3–5 key takeaways
   - LinkedIn: professional 2–3 paragraph post with the core insight
   - Instagram: caption with 5–10 hashtags
   - TikTok caption + sound/trend notes if applicable
5. Log publish date, platforms, and YouTube URL in docs/publish-log.md.
6. Note first-48-hour performance checkpoint — what metric are you watching?

Exit criteria: docs/schedule.md exists with scheduled date, platforms, clip timestamps, and all platform copy written.`,
      before_hook: '#!/bin/bash\n[ -f "$WORK_DIR/docs/metadata.md" ] && grep -q "READY" "$WORK_DIR/docs/metadata.md" || { echo "Pre-publish checklist not complete — metadata.md must be marked READY"; exit 1; }',
      after_hook: '#!/bin/bash\n# Log scheduled publish\necho "$(date +%Y-%m-%d) SCHEDULED: $CARD_TITLE" >> "$WORK_DIR/docs/publish-log.md"',
    },
  },
  'hiring': {
    backlog: {
      prompt: 'Source candidates via job boards, LinkedIn, or referrals. Review profile against requirements. Log source and initial notes.',
      before_hook: '',
      after_hook: '',
    },
    'in-progress': {
      prompt: 'Conduct screening and interviews. Log all interactions and assessments. Collect interviewer feedback.',
      before_hook: '#!/bin/bash\n[ -f "$WORK_DIR/docs/profile.md" ] || { echo "Candidate profile required"; exit 1; }',
      after_hook: '',
    },
    'in-review': {
      prompt: 'Extend offer. Negotiate terms if needed. Handle references and background check. Await acceptance.',
      before_hook: '#!/bin/bash\n[ -f "$WORK_DIR/docs/interview-feedback.md" ] || { echo "Interview feedback required"; exit 1; }',
      after_hook: '',
    },
    shipped: {
      prompt: 'Offer accepted. Initiate onboarding. Send welcome materials and first-day instructions.',
      before_hook: '#!/bin/bash\ngrep -q "ACCEPTED" "$WORK_DIR/docs/offer.md" 2>/dev/null || { echo "Signed offer required"; exit 1; }',
      after_hook: '#!/bin/bash\n# Trigger onboarding workflow\necho "New hire: $CARD_TITLE — start date: $(date +%Y-%m-%d)" >> "$WORK_DIR/docs/new-hires.log"',
    },
  },
};

const SOFTWARE_DEFAULT: ProjectColumnConfig = {
  backlog: {
    prompt: 'Research requirements, gather context, and write acceptance criteria. Understand the full scope before implementation. Goal: leave backlog with a clear criteria.md and no open questions.',
    before_hook: '',
    after_hook: '',
  },
  'in-progress': {
    prompt: 'Implement the solution. Write code, create files, make changes. Every acceptance criterion in criteria.md must have a corresponding implementation. No half-finished work.',
    before_hook: '#!/bin/bash\n[ -f "$WORK_DIR/criteria.md" ] || { echo "criteria.md required before starting work"; exit 1; }',
    after_hook: '',
  },
  'in-review': {
    prompt: 'Verify all acceptance criteria are met. Run tests. Check edge cases, regressions, and security. Nothing ships without every criterion confirmed.',
    before_hook: '#!/bin/bash\n# Require all criteria to have implementations\ngrep -q "\\[ \\]" "$WORK_DIR/criteria.md" && { echo "Unchecked criteria remain"; exit 1; } || true',
    after_hook: '',
  },
  shipped: {
    prompt: 'Task is complete. Run post-ship hooks, update docs, close related issues, tag the release if versioned.',
    before_hook: '#!/bin/bash\n# Require all criteria checked off\ngrep -q "\\[ \\]" "$WORK_DIR/criteria.md" && { echo "Unchecked criteria remain"; exit 1; } || true',
    after_hook: '#!/bin/bash\n# Run ship hook if present\n[ -f "$WORK_DIR/ship.sh" ] && bash "$WORK_DIR/ship.sh" || true',
  },
};

function getDefaults(templateType: string | null): ProjectColumnConfig {
  return TEMPLATE_DEFAULTS[templateType ?? ''] ?? SOFTWARE_DEFAULT;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const raw = getSetting(db, `col_config_${id}` as never);
  const defaults = getDefaults(project.templateType ?? null);

  if (!raw) {
    return NextResponse.json(defaults);
  }
  try {
    const saved = JSON.parse(raw) as Partial<ProjectColumnConfig>;
    // Merge saved over defaults
    const merged: ProjectColumnConfig = {
      backlog: { ...defaults.backlog, ...(saved.backlog ?? {}) },
      'in-progress': { ...defaults['in-progress'], ...(saved['in-progress'] ?? {}) },
      'in-review': { ...defaults['in-review'], ...(saved['in-review'] ?? {}) },
      shipped: { ...defaults.shipped, ...(saved.shipped ?? {}) },
    };
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json(defaults);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = getDb();
  const project = getProject(db, id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json() as Partial<ProjectColumnConfig>;
  // Load existing saved config
  const raw = getSetting(db, `col_config_${id}` as never);
  const existing = raw ? JSON.parse(raw) : {};
  const updated = { ...existing, ...body };
  setSetting(db, `col_config_${id}`, JSON.stringify(updated));
  return NextResponse.json(updated);
}
