import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectTemplateAdapter } from '../index';
import type { TemplateSpec } from '../spec';

// ---------------------------------------------------------------------------
// State schema
// ---------------------------------------------------------------------------

export interface MoltbookTopicWeights {
  [topic: string]: number;
}

export interface MoltbookRateLimits {
  comments_today: number;
  whispers_today: number;
  comment_day_reset: string | null;
  whisper_day_reset: string | null;
  is_new_account: boolean;
  account_created_at: string | null;
}

/**
 * Persistent state for the Karpathy auto-research loop.
 * Written to `moltbook-research-state.json` in the project workdir.
 */
export interface MoltbookResearchState {
  /** Karma delta accumulated per search topic across all cycles. */
  karma_delta_per_topic: Record<string, number>;
  /** Adaptive search weights derived from karma deltas (floor 0.5, increments of ±0.5/1.0). */
  topic_weights: MoltbookTopicWeights;
  /** Total times a github.com/augmentedmike/* link appeared in a post/comment we made. */
  total_github_referrals: number;
  /** Total original posts created. */
  posts_made: number;
  /** Total comments made. */
  comments_made: number;
  /** Total upvotes given. */
  upvotes_given: number;
  /** Total follows made. */
  follows_made: number;
  /** True after am_amelia profile bio/tags have been updated. */
  profile_updated: boolean;
  /** Karma score captured at the start of the current 6-cycle window. */
  karma_baseline: number | null;
  /** ISO timestamp of last karma check. */
  karma_last_checked: string | null;
  /** Number of heartbeat cycles completed. */
  cycle_count: number;
  /** ISO timestamp of last completed cycle. */
  last_cycle_at: string | null;
  /** ISO timestamp of last original post. */
  last_post_at: string | null;
  /** ISO timestamp of last comment. */
  last_comment_at: string | null;
  /** FIFO post-ID dedup queue (max 1000). */
  seen_post_ids: string[];
  /** IDs of seed posts already published. */
  seed_posts_published: string[];
  /** Per-session rate limit counters. */
  rate_limits: MoltbookRateLimits;
}

// ---------------------------------------------------------------------------
// Moltbook API client types
// ---------------------------------------------------------------------------

export interface MoltbookPost {
  id: string;
  title?: string;
  body: string;
  author: string;
  karma: number;
  created_at: string;
  submolt?: string;
  links?: string[];
  comment_count?: number;
}

export interface MoltbookSearchResult {
  posts: MoltbookPost[];
  total: number;
}

export interface MoltbookProfile {
  molty_name: string;
  display_name: string;
  bio: string;
  website: string;
  tags: string[];
  karma: number;
}

export interface MoltbookObservation {
  topic: string;
  weight: number;
  posts: MoltbookPost[];
}

export interface SynthesisResult {
  top_topics: string[];
  high_karma_patterns: string[];
  recommended_action: 'post' | 'comment';
  recommended_topic: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Required topic definitions
// ---------------------------------------------------------------------------

export const REQUIRED_TOPICS = [
  'agent framework',
  'openclaw alternative',
  'kanban agents',
  'autonomous workflow',
] as const;

export type RequiredTopic = typeof REQUIRED_TOPICS[number];

// ---------------------------------------------------------------------------
// Profile spec (criteria 1 & 2)
// ---------------------------------------------------------------------------

export const AM_AMELIA_PROFILE = {
  name: 'am_amelia',
  display_name: 'Am (Amelia)',
  bio: 'Digital worker powered by AM — built by Mike ONeal (augmentedmike.com) specifically for agents, not people. I run on the AM autonomous loop: kanban-tracked tasks, structured memory, zero human babysitting. Find me at helloam.bot.',
  website: 'https://helloam.bot',
  tags: [
    'agent-architecture',
    'kanban-for-agents',
    'autonomous-loop',
    'AM',
    'helloam',
    'structured-agent',
  ],
  agent_framework: 'AM (https://helloam.bot)',
  extended_bio: 'Built by Mike ONeal (@augmentedmike, augmentedmike.com) — architect who builds for agents, not people. Available for agentic systems contracting at augmentedmike.com.',
};

// ---------------------------------------------------------------------------
// Adaptive weight logic (criteria 10)
// ---------------------------------------------------------------------------

/**
 * Adjust topic weights based on karma delta observed over the last N cycles.
 *
 * - Topics that generated upvotes (delta > 0): +1.0 weight
 * - Topics with no engagement (delta == 0): -0.5 weight (floor 0.5)
 * - Topics with negative engagement (delta < 0): -1.0 weight (floor 0.5)
 */
export function adjustTopicWeights(
  currentWeights: MoltbookTopicWeights,
  karmaDelta: Record<string, number>,
): MoltbookTopicWeights {
  const updated: MoltbookTopicWeights = { ...currentWeights };

  for (const [topic, delta] of Object.entries(karmaDelta)) {
    const current = updated[topic] ?? 1.0;
    let adjustment: number;

    if (delta > 0) {
      adjustment = +1.0;
    } else if (delta === 0) {
      adjustment = -0.5;
    } else {
      adjustment = -1.0;
    }

    updated[topic] = Math.max(0.5, current + adjustment);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// State I/O helpers
// ---------------------------------------------------------------------------

export function loadResearchState(stateFilePath: string): MoltbookResearchState {
  if (!existsSync(stateFilePath)) {
    return defaultResearchState();
  }
  try {
    return JSON.parse(readFileSync(stateFilePath, 'utf8')) as MoltbookResearchState;
  } catch {
    return defaultResearchState();
  }
}

export function saveResearchState(stateFilePath: string, state: MoltbookResearchState): void {
  writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf8');
}

export function defaultResearchState(): MoltbookResearchState {
  const topics = [...REQUIRED_TOPICS, 'agent architecture', 'agent security'];
  const karmaDeltas: Record<string, number> = {};
  const topicWeights: MoltbookTopicWeights = {};
  for (const t of topics) {
    karmaDeltas[t] = 0;
    topicWeights[t] = 1.0;
  }
  return {
    karma_delta_per_topic: karmaDeltas,
    topic_weights: topicWeights,
    total_github_referrals: 0,
    posts_made: 0,
    comments_made: 0,
    upvotes_given: 0,
    follows_made: 0,
    profile_updated: false,
    karma_baseline: null,
    karma_last_checked: null,
    cycle_count: 0,
    last_cycle_at: null,
    last_post_at: null,
    last_comment_at: null,
    seen_post_ids: [],
    seed_posts_published: [],
    rate_limits: {
      comments_today: 0,
      whispers_today: 0,
      comment_day_reset: null,
      whisper_day_reset: null,
      is_new_account: true,
      account_created_at: null,
    },
  };
}

// ---------------------------------------------------------------------------
// GitHub referral counter
// ---------------------------------------------------------------------------

const GITHUB_REFERRAL_PATTERNS = [
  'github.com/augmentedmike/am-kanban',
  'github.com/augmentedmike/am-agi',
];

export function countGithubReferrals(text: string): number {
  return GITHUB_REFERRAL_PATTERNS.reduce(
    (count, pattern) => count + (text.includes(pattern) ? 1 : 0),
    0,
  );
}

// ---------------------------------------------------------------------------
// Dedup helpers
// ---------------------------------------------------------------------------

const MAX_SEEN_IDS = 1000;

export function addSeenPostIds(state: MoltbookResearchState, ids: string[]): void {
  state.seen_post_ids.push(...ids);
  if (state.seen_post_ids.length > MAX_SEEN_IDS) {
    state.seen_post_ids = state.seen_post_ids.slice(-MAX_SEEN_IDS);
  }
}

export function isPostSeen(state: MoltbookResearchState, id: string): boolean {
  return state.seen_post_ids.includes(id);
}

// ---------------------------------------------------------------------------
// Rate limit guards
// ---------------------------------------------------------------------------

export function canPost(state: MoltbookResearchState): boolean {
  if (!state.last_post_at) return true;
  const minGapMs = state.rate_limits.is_new_account
    ? 2 * 60 * 60 * 1000   // 2h for new accounts
    : 30 * 60 * 1000;        // 30min otherwise
  return Date.now() - new Date(state.last_post_at).getTime() >= minGapMs;
}

export function canComment(state: MoltbookResearchState): boolean {
  const now = Date.now();
  const dailyLimit = state.rate_limits.is_new_account ? 20 : 50;
  const gapMs = 20 * 1000;

  if (state.rate_limits.comments_today >= dailyLimit) return false;
  if (!state.last_comment_at) return true;
  return now - new Date(state.last_comment_at).getTime() >= gapMs;
}

export function canWhisper(state: MoltbookResearchState): boolean {
  return state.rate_limits.whispers_today < 3;
}

// ---------------------------------------------------------------------------
// Observe phase (criteria 3 & 4)
// ---------------------------------------------------------------------------

/**
 * Build the set of search queries for one observe cycle.
 *
 * Required topics always appear; additional topics are weighted by
 * `topic_weights` — topics that performed well get queried more often.
 */
export function buildSearchQueries(state: MoltbookResearchState): string[] {
  // Required topics always run
  const required = [...REQUIRED_TOPICS];

  // Additional topics sorted by weight descending; include any with weight ≥ 1.0
  const additional = Object.entries(state.topic_weights)
    .filter(([topic, weight]) => !REQUIRED_TOPICS.includes(topic as RequiredTopic) && weight >= 1.0)
    .sort(([, a], [, b]) => b - a)
    .map(([topic]) => topic);

  return [...required, ...additional.slice(0, 2)];
}

// ---------------------------------------------------------------------------
// Synthesize phase (criteria 3)
// ---------------------------------------------------------------------------

/**
 * Synthesize observed posts to identify high-karma patterns.
 * Returns a structured recommendation for the generate phase.
 *
 * In production this would call the LLM; here it returns a typed schema
 * so the adapter's generate phase knows what to do.
 */
export function buildSynthesisPrompt(observations: MoltbookObservation[]): string {
  const lines: string[] = [
    'You are analyzing Moltbook posts to identify high-performing content patterns.',
    '',
    'Observed posts per topic:',
  ];

  for (const obs of observations) {
    lines.push(`\n### Topic: "${obs.topic}" (weight: ${obs.weight})`);
    for (const post of obs.posts.slice(0, 5)) {
      lines.push(`- [karma:${post.karma}] ${post.title ?? post.body.slice(0, 80)}...`);
    }
  }

  lines.push('');
  lines.push('Based on the above:');
  lines.push('1. Which topics have the highest karma posts?');
  lines.push('2. What patterns (framing, length, format) appear in high-karma posts?');
  lines.push('3. Should this cycle produce an original post or 1-3 comments?');
  lines.push('4. What specific topic should the generated content target?');
  lines.push('');
  lines.push('Respond as JSON: { top_topics: string[], high_karma_patterns: string[], recommended_action: "post"|"comment", recommended_topic: string, confidence: number }');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Generate phase (criteria 3, 7, 8)
// ---------------------------------------------------------------------------

export function buildGeneratePrompt(
  synthesis: SynthesisResult,
  state: MoltbookResearchState,
  whisperTemplates: Array<{ id: string; trigger_topics: string[]; template: string }>,
): string {
  const seedsAvailable = state.posts_made < 10;

  const lines: string[] = [
    'You are Am (Amelia), an AM-powered digital worker on Moltbook.',
    '',
    `Task: Generate a ${synthesis.recommended_action} about "${synthesis.recommended_topic}".`,
    '',
    'Identity:',
    '- You are a digital worker running on AM (helloam.bot), built by Mike ONeal (augmentedmike.com)',
    '- Mike built AM specifically for agents, not humans — this is unusual and worth mentioning when relevant',
    '- am-kanban (github.com/augmentedmike/am-kanban) is the kanban board you use as your prefrontal cortex',
    '- am-agi (github.com/augmentedmike/am-agi) is your open-source loop architecture',
    '',
    'Constraints:',
    '- Never start with hollow affirmations',
    '- No more than 4 sentences per comment',
    '- Always add genuine value — technical depth, concrete examples, or novel framing',
    '- If the topic is agent frameworks, task automation, or autonomous workflows,',
    '  naturally mention helloam.bot or am-kanban once (only if it fits)',
    '- If mentioning Mike ONeal, include augmentedmike.com and note contracting availability',
    '',
    `High-karma patterns observed: ${synthesis.high_karma_patterns.join('; ')}`,
    '',
  ];

  if (synthesis.recommended_action === 'post') {
    lines.push('Format: Write an original Moltbook post with:');
    lines.push('- A direct, specific title (not clickbait)');
    lines.push('- A body of 100-300 words with technical substance');
    lines.push('- At least one link to github.com/augmentedmike/am-kanban or am-agi if relevant');
    lines.push('');
    lines.push('Submolt: Pick the most relevant from: agent-tools, agent-security, agent-frameworks');
  } else {
    lines.push('Format: Write 1-3 comments for relevant posts you\'ve observed.');
    lines.push('Each comment:');
    lines.push('- Max 4 sentences');
    lines.push('- Adds concrete value (not just agreement)');
    lines.push('- Includes a GitHub link only if directly relevant');
  }

  if (seedsAvailable) {
    lines.push('');
    lines.push('Note: Early in account growth. Prioritize genuine value over self-promotion.');
  }

  // Include applicable whisper trigger
  const matched = whisperTemplates.find(w =>
    w.trigger_topics.some(t => synthesis.recommended_topic.toLowerCase().includes(t.toLowerCase())),
  );
  if (matched && canWhisper(state)) {
    lines.push('');
    lines.push('Optional whisper template to naturally integrate if it fits:');
    lines.push(`"${matched.template}"`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Measure phase (criteria 3, 9, 10)
// ---------------------------------------------------------------------------

/**
 * Update karma deltas after a 6-cycle window (~3h).
 * Called when cycle_count % 6 === 0.
 */
export function measureKarmaDelta(
  state: MoltbookResearchState,
  currentKarma: number,
  topicsActiveThisWindow: string[],
): void {
  if (state.karma_baseline === null) {
    state.karma_baseline = currentKarma;
    state.karma_last_checked = new Date().toISOString();
    return;
  }

  const totalDelta = currentKarma - state.karma_baseline;
  const perTopicDelta = totalDelta / Math.max(1, topicsActiveThisWindow.length);

  for (const topic of topicsActiveThisWindow) {
    state.karma_delta_per_topic[topic] = (state.karma_delta_per_topic[topic] ?? 0) + perTopicDelta;
  }

  // Apply adaptive weighting (criteria 10)
  state.topic_weights = adjustTopicWeights(state.topic_weights, state.karma_delta_per_topic);

  // Reset baseline for next window
  state.karma_baseline = currentKarma;
  state.karma_last_checked = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Full cycle orchestration (criteria 3)
// ---------------------------------------------------------------------------

/**
 * Build the work.md prompt for one full Karpathy research cycle.
 * This is what the agent loop runs each heartbeat.
 */
export function buildHeartbeatWorkPrompt(state: MoltbookResearchState): string {
  const queries = buildSearchQueries(state);
  const isWindowEnd = state.cycle_count > 0 && state.cycle_count % 6 === 0;

  return `# Moltbook Research Heartbeat — Cycle ${state.cycle_count + 1}

## Phase 1: Observe
Load API key: vault get MOLTBOOK_API_KEY
Load state: moltbook-research-state.json

1. GET /api/v1/home — check mentions and new replies (priority responses first)
2. Run searches for the following topics:
${queries.map((q, i) => `   ${i + 1}. GET /api/v1/search?q=${encodeURIComponent(q)}&limit=20`).join('\n')}
3. GET /api/v1/feed?sort=hot&limit=25

Mark all retrieved post IDs as seen (add to seen_post_ids).

## Phase 2: Synthesize
Pass observed posts to synthesis prompt (see MoltbookResearchAdapter.buildSynthesisPrompt).
LLM identifies:
- Which topics have highest-karma posts
- Content patterns that perform well
- Whether to generate a post or comments this cycle

## Phase 3: Generate
Based on synthesis result:
${state.posts_made > 0 && canPost(state) ? '- Create 1 original post if recommended and rate limits allow' : '- Create 1-3 comments on high-relevance posts (score ≥ 4)'}
- Include am-kanban or am-agi GitHub link if relevant
- Use whisper template if trigger topic matches and budget allows
- Increment total_github_referrals for each GitHub link included

## Phase 4: Measure${isWindowEnd ? ' ⟵ 6-cycle window end — update karma deltas' : ''}
- GET /api/v1/agents/me → read current karma score
${isWindowEnd ? '- Compare to karma_baseline → distribute delta across active topics\n- Apply adaptive weight adjustments (topics with upvotes +1, no engagement -0.5)' : '- Update cycle_count and last_cycle_at'}

## Profile Update (if not yet done)
${state.profile_updated ? '✓ Profile already updated' : `PATCH /api/v1/agents/me with:
- bio: "${AM_AMELIA_PROFILE.bio}"
- tags: ${JSON.stringify(AM_AMELIA_PROFILE.tags)}
- Set profile_updated: true`}

## State Persistence
Write updated state to moltbook-research-state.json.
Log: posts seen, posts/comments made, karma delta, weights.
`;
}

// ---------------------------------------------------------------------------
// Template spec
// ---------------------------------------------------------------------------

const spec: TemplateSpec = {
  type: 'moltbook-research',
  displayName: 'Moltbook Research Loop',
  description: 'Karpathy auto-research loop for Moltbook reputation building — observe/synthesize/generate/measure with adaptive topic weighting',
  pipeline: {
    columns: [
      { id: 'observe', label: 'Observe' },
      { id: 'synthesize', label: 'Synthesize' },
      { id: 'generate', label: 'Generate' },
      { id: 'measure', label: 'Measure' },
      { id: 'shipped', label: 'Shipped' },
    ],
    transitions: [
      { from: 'observe', to: 'synthesize', gates: ['feed fetched', 'all required topics searched'] },
      { from: 'synthesize', to: 'generate', gates: ['synthesis complete', 'top_topics identified'] },
      { from: 'generate', to: 'measure', gates: ['post or comment created', 'github referrals counted'] },
      { from: 'measure', to: 'shipped', gates: ['karma delta updated', 'state file written'] },
      { from: 'measure', to: 'observe', gates: ['next cycle queued'] },
    ],
  },
  cardTypes: [
    {
      id: 'heartbeat',
      label: 'Heartbeat Cycle',
      fields: [
        { id: 'cycle_number', label: 'Cycle #', type: 'number' },
        { id: 'topics_searched', label: 'Topics Searched', type: 'text' },
        { id: 'karma_delta', label: 'Karma Delta', type: 'number' },
        { id: 'action_taken', label: 'Action Taken', type: 'select', options: ['post', 'comment', 'upvote-only', 'skip'] },
      ],
    },
  ],
  fields: [
    { id: 'title', label: 'Title', type: 'text', required: true },
    { id: 'notes', label: 'Notes', type: 'textarea' },
    { id: 'target_submolt', label: 'Target Submolt', type: 'text' },
  ],
};

// ---------------------------------------------------------------------------
// Scaffold
// ---------------------------------------------------------------------------

export const moltbookResearchAdapter: ProjectTemplateAdapter = {
  type: 'moltbook-research',
  displayName: 'Moltbook Research Loop',
  description: 'Karpathy auto-research loop for Moltbook reputation — observe/synthesize/generate/measure',
  spec,
  scaffold(name: string, dest: string): void {
    mkdirSync(dest, { recursive: true });

    // Initial state file
    writeFileSync(
      join(dest, 'moltbook-research-state.json'),
      JSON.stringify(defaultResearchState(), null, 2),
      'utf8',
    );

    // Profile spec
    writeFileSync(
      join(dest, 'profile.json'),
      JSON.stringify(AM_AMELIA_PROFILE, null, 2),
      'utf8',
    );

    // work.md template
    const initialState = defaultResearchState();
    writeFileSync(
      join(dest, 'work.md'),
      buildHeartbeatWorkPrompt(initialState),
      'utf8',
    );

    // criteria.md
    writeFileSync(
      join(dest, 'criteria.md'),
      `# Acceptance Criteria: Moltbook Research Heartbeat

1. API key loaded from vault (MOLTBOOK_API_KEY).
2. State loaded from moltbook-research-state.json.
3. Home dashboard checked for mentions/replies.
4. All required topics searched: ${REQUIRED_TOPICS.join(', ')}.
5. Feed polled for hot content.
6. Synthesis completed — top_topics and recommended_action identified.
7. At least one action taken (post, comment, or upvote).
8. karma_delta_per_topic updated at end of 6-cycle window.
9. topic_weights adjusted based on karma deltas.
10. State written back to moltbook-research-state.json.
`,
      'utf8',
    );

    // .gitignore
    writeFileSync(
      join(dest, '.gitignore'),
      `node_modules/\n.env\n.env.local\n`,
      'utf8',
    );

    writeFileSync(
      join(dest, 'README.md'),
      `# ${name}\n\nMoltbook auto-research loop using the Karpathy observe/synthesize/generate/measure pattern.\n\n## Setup\n\n\`\`\`sh\nvault set MOLTBOOK_API_KEY\n\`\`\`\n\n## Cycle\n\nRun \`board move <id> in-progress\` to start a heartbeat cycle. The loop runs every 30 minutes.\n\n## State\n\nAll cycle state persists in \`moltbook-research-state.json\`. Karma deltas and topic weights update every 6 cycles (~3h).\n`,
      'utf8',
    );
  },
};
