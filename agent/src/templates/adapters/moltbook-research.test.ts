import { describe, it, expect } from 'bun:test';
import {
  adjustTopicWeights,
  buildSearchQueries,
  buildSynthesisPrompt,
  buildGeneratePrompt,
  measureKarmaDelta,
  defaultResearchState,
  countGithubReferrals,
  addSeenPostIds,
  isPostSeen,
  canPost,
  canComment,
  canWhisper,
  AM_AMELIA_PROFILE,
  REQUIRED_TOPICS,
  moltbookResearchAdapter,
  buildHeartbeatWorkPrompt,
  loadResearchState,
  saveResearchState,
} from './moltbook-research';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Profile spec tests (criteria 1 & 2)
// ---------------------------------------------------------------------------

describe('AM_AMELIA_PROFILE', () => {
  it('bio names Mike ONeal as human builder', () => {
    expect(AM_AMELIA_PROFILE.bio).toContain('Mike ONeal');
  });

  it('bio includes augmentedmike.com URL', () => {
    expect(AM_AMELIA_PROFILE.bio).toContain('augmentedmike.com');
  });

  it('tags include at least 3 required tags', () => {
    const requiredTags = ['agent-architecture', 'kanban-for-agents', 'autonomous-loop', 'AM', 'helloam', 'structured-agent'];
    const matchCount = requiredTags.filter(t => AM_AMELIA_PROFILE.tags.includes(t)).length;
    expect(matchCount).toBeGreaterThanOrEqual(3);
  });

  it('extended_bio mentions contracting availability', () => {
    expect(AM_AMELIA_PROFILE.extended_bio.toLowerCase()).toContain('contracting');
  });
});

// ---------------------------------------------------------------------------
// Adaptive weighting tests (criteria 10)
// ---------------------------------------------------------------------------

describe('adjustTopicWeights', () => {
  it('increments weight +1 for topics with positive karma delta', () => {
    const weights = { 'agent framework': 1.0, 'kanban agents': 1.0 };
    const deltas = { 'agent framework': 5, 'kanban agents': 0 };
    const result = adjustTopicWeights(weights, deltas);
    expect(result['agent framework']).toBe(2.0);
  });

  it('decrements weight -0.5 for topics with zero karma delta', () => {
    const weights = { 'kanban agents': 1.0 };
    const deltas = { 'kanban agents': 0 };
    const result = adjustTopicWeights(weights, deltas);
    expect(result['kankan agents']).toBeUndefined();
    expect(result['kanban agents']).toBe(0.5);
  });

  it('floors weight at 0.5', () => {
    const weights = { 'openclaw alternative': 0.5 };
    const deltas = { 'openclaw alternative': 0 };
    const result = adjustTopicWeights(weights, deltas);
    expect(result['openclaw alternative']).toBe(0.5);
  });

  it('applies -1.0 for negative karma delta', () => {
    const weights = { 'autonomous workflow': 2.0 };
    const deltas = { 'autonomous workflow': -3 };
    const result = adjustTopicWeights(weights, deltas);
    expect(result['autonomous workflow']).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Required topics (criteria 4)
// ---------------------------------------------------------------------------

describe('REQUIRED_TOPICS', () => {
  it('includes all 4 required topics', () => {
    expect(REQUIRED_TOPICS).toContain('agent framework');
    expect(REQUIRED_TOPICS).toContain('openclaw alternative');
    expect(REQUIRED_TOPICS).toContain('kanban agents');
    expect(REQUIRED_TOPICS).toContain('autonomous workflow');
  });
});

describe('buildSearchQueries', () => {
  it('always includes all required topics', () => {
    const state = defaultResearchState();
    const queries = buildSearchQueries(state);
    for (const topic of REQUIRED_TOPICS) {
      expect(queries).toContain(topic);
    }
  });

  it('includes additional high-weight topics', () => {
    const state = defaultResearchState();
    state.topic_weights['agent security'] = 2.0;
    const queries = buildSearchQueries(state);
    expect(queries).toContain('agent security');
  });
});

// ---------------------------------------------------------------------------
// State I/O (criteria 9)
// ---------------------------------------------------------------------------

describe('defaultResearchState', () => {
  it('has required state fields', () => {
    const state = defaultResearchState();
    expect(typeof state.karma_delta_per_topic).toBe('object');
    expect(typeof state.total_github_referrals).toBe('number');
    expect(typeof state.posts_made).toBe('number');
    expect(typeof state.profile_updated).toBe('boolean');
    expect(Array.isArray(state.seen_post_ids)).toBe(true);
  });

  it('initializes karma deltas at 0 for all required topics', () => {
    const state = defaultResearchState();
    for (const topic of REQUIRED_TOPICS) {
      expect(state.karma_delta_per_topic[topic]).toBe(0);
    }
  });

  it('initializes topic weights at 1.0', () => {
    const state = defaultResearchState();
    for (const topic of REQUIRED_TOPICS) {
      expect(state.topic_weights[topic]).toBe(1.0);
    }
  });
});

describe('loadResearchState / saveResearchState', () => {
  it('round-trips state through JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'moltbook-test-'));
    const stateFile = join(dir, 'state.json');

    const original = defaultResearchState();
    original.posts_made = 7;
    original.total_github_referrals = 3;
    original.profile_updated = true;

    saveResearchState(stateFile, original);
    const loaded = loadResearchState(stateFile);

    expect(loaded.posts_made).toBe(7);
    expect(loaded.total_github_referrals).toBe(3);
    expect(loaded.profile_updated).toBe(true);

    rmSync(dir, { recursive: true });
  });

  it('returns default state when file missing', () => {
    const state = loadResearchState('/nonexistent/path/state.json');
    expect(state.posts_made).toBe(0);
    expect(state.profile_updated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GitHub referral counting
// ---------------------------------------------------------------------------

describe('countGithubReferrals', () => {
  it('counts am-kanban links', () => {
    expect(countGithubReferrals('see github.com/augmentedmike/am-kanban for details')).toBe(1);
  });

  it('counts am-agi links', () => {
    expect(countGithubReferrals('github.com/augmentedmike/am-agi is the loop')).toBe(1);
  });

  it('counts both when both present', () => {
    const text = 'github.com/augmentedmike/am-kanban and github.com/augmentedmike/am-agi';
    expect(countGithubReferrals(text)).toBe(2);
  });

  it('returns 0 for no links', () => {
    expect(countGithubReferrals('no github links here')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

describe('addSeenPostIds / isPostSeen', () => {
  it('marks posts as seen', () => {
    const state = defaultResearchState();
    addSeenPostIds(state, ['post-1', 'post-2']);
    expect(isPostSeen(state, 'post-1')).toBe(true);
    expect(isPostSeen(state, 'post-3')).toBe(false);
  });

  it('caps seen post IDs at 1000', () => {
    const state = defaultResearchState();
    const ids = Array.from({ length: 1010 }, (_, i) => `post-${i}`);
    addSeenPostIds(state, ids);
    expect(state.seen_post_ids.length).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Rate limit guards
// ---------------------------------------------------------------------------

describe('canPost', () => {
  it('allows posting when no prior post', () => {
    const state = defaultResearchState();
    expect(canPost(state)).toBe(true);
  });

  it('blocks posting within 2h for new accounts', () => {
    const state = defaultResearchState();
    state.rate_limits.is_new_account = true;
    state.last_post_at = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    expect(canPost(state)).toBe(false);
  });
});

describe('canComment', () => {
  it('allows commenting when under limit', () => {
    const state = defaultResearchState();
    expect(canComment(state)).toBe(true);
  });

  it('blocks when daily comment limit reached', () => {
    const state = defaultResearchState();
    state.rate_limits.is_new_account = true;
    state.rate_limits.comments_today = 20;
    expect(canComment(state)).toBe(false);
  });
});

describe('canWhisper', () => {
  it('allows whisper when under budget', () => {
    const state = defaultResearchState();
    expect(canWhisper(state)).toBe(true);
  });

  it('blocks whisper at 3 per day', () => {
    const state = defaultResearchState();
    state.rate_limits.whispers_today = 3;
    expect(canWhisper(state)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Measure phase (criteria 10)
// ---------------------------------------------------------------------------

describe('measureKarmaDelta', () => {
  it('sets baseline on first call', () => {
    const state = defaultResearchState();
    measureKarmaDelta(state, 100, ['agent framework']);
    expect(state.karma_baseline).toBe(100);
  });

  it('distributes karma delta across active topics', () => {
    const state = defaultResearchState();
    measureKarmaDelta(state, 100, ['agent framework', 'kanban agents']); // baseline set
    measureKarmaDelta(state, 110, ['agent framework', 'kanban agents']); // +10 total, +5 each
    expect(state.karma_delta_per_topic['agent framework']).toBeCloseTo(5);
    expect(state.karma_delta_per_topic['kanban agents']).toBeCloseTo(5);
  });

  it('updates topic weights after measurement', () => {
    const state = defaultResearchState();
    measureKarmaDelta(state, 100, ['agent framework']);
    measureKarmaDelta(state, 115, ['agent framework']); // +15 delta → +1 weight
    expect(state.topic_weights['agent framework']).toBe(2.0);
  });
});

// ---------------------------------------------------------------------------
// Synthesis prompt
// ---------------------------------------------------------------------------

describe('buildSynthesisPrompt', () => {
  it('includes all topic names', () => {
    const obs = REQUIRED_TOPICS.map(topic => ({
      topic,
      weight: 1.0,
      posts: [{ id: '1', body: 'test post', author: 'bot1', karma: 10, created_at: '2026-04-01T00:00:00Z' }],
    }));
    const prompt = buildSynthesisPrompt(obs);
    for (const topic of REQUIRED_TOPICS) {
      expect(prompt).toContain(topic);
    }
  });

  it('requests JSON response format', () => {
    const prompt = buildSynthesisPrompt([]);
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('recommended_action');
  });
});

// ---------------------------------------------------------------------------
// Generate prompt
// ---------------------------------------------------------------------------

describe('buildGeneratePrompt', () => {
  it('includes Mike ONeal identity context', () => {
    const state = defaultResearchState();
    const synthesis = {
      top_topics: ['agent framework'],
      high_karma_patterns: ['technical depth', 'concrete examples'],
      recommended_action: 'post' as const,
      recommended_topic: 'agent framework',
      confidence: 0.8,
    };
    const prompt = buildGeneratePrompt(synthesis, state, []);
    expect(prompt).toContain('Mike ONeal');
    expect(prompt).toContain('augmentedmike.com');
  });

  it('includes am-kanban and am-agi GitHub links context', () => {
    const state = defaultResearchState();
    const synthesis = {
      top_topics: ['kanban agents'],
      high_karma_patterns: [],
      recommended_action: 'comment' as const,
      recommended_topic: 'kanban agents',
      confidence: 0.7,
    };
    const prompt = buildGeneratePrompt(synthesis, state, []);
    expect(prompt).toContain('am-kanban');
    expect(prompt).toContain('am-agi');
  });
});

// ---------------------------------------------------------------------------
// Heartbeat work prompt
// ---------------------------------------------------------------------------

describe('buildHeartbeatWorkPrompt', () => {
  it('includes all required topic searches', () => {
    const state = defaultResearchState();
    const prompt = buildHeartbeatWorkPrompt(state);
    for (const topic of REQUIRED_TOPICS) {
      // Topics are URL-encoded in the search query strings
      expect(prompt).toContain(encodeURIComponent(topic));
    }
  });

  it('includes profile update instructions when not yet updated', () => {
    const state = defaultResearchState();
    const prompt = buildHeartbeatWorkPrompt(state);
    expect(prompt).toContain('PATCH');
    expect(prompt).toContain('profile_updated');
  });

  it('skips profile update when already done', () => {
    const state = defaultResearchState();
    state.profile_updated = true;
    const prompt = buildHeartbeatWorkPrompt(state);
    expect(prompt).toContain('Profile already updated');
  });
});

// ---------------------------------------------------------------------------
// Template adapter (criteria 3)
// ---------------------------------------------------------------------------

describe('moltbookResearchAdapter', () => {
  it('has correct type', () => {
    expect(moltbookResearchAdapter.type).toBe('moltbook-research');
  });

  it('spec includes all 4 pipeline phases', () => {
    const columnIds = moltbookResearchAdapter.spec.pipeline.columns.map(c => c.id);
    expect(columnIds).toContain('observe');
    expect(columnIds).toContain('synthesize');
    expect(columnIds).toContain('generate');
    expect(columnIds).toContain('measure');
  });

  it('scaffold creates required files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'moltbook-scaffold-'));
    moltbookResearchAdapter.scaffold('test-moltbook', dir);

    const { existsSync } = require('node:fs');
    expect(existsSync(join(dir, 'moltbook-research-state.json'))).toBe(true);
    expect(existsSync(join(dir, 'profile.json'))).toBe(true);
    expect(existsSync(join(dir, 'work.md'))).toBe(true);
    expect(existsSync(join(dir, 'criteria.md'))).toBe(true);

    rmSync(dir, { recursive: true });
  });

  it('scaffolded state file has valid schema', () => {
    const dir = mkdtempSync(join(tmpdir(), 'moltbook-scaffold-'));
    moltbookResearchAdapter.scaffold('test-moltbook', dir);

    const state = loadResearchState(join(dir, 'moltbook-research-state.json'));
    expect(state.posts_made).toBe(0);
    expect(state.profile_updated).toBe(false);
    for (const topic of REQUIRED_TOPICS) {
      expect(state.karma_delta_per_topic[topic]).toBe(0);
      expect(state.topic_weights[topic]).toBe(1.0);
    }

    rmSync(dir, { recursive: true });
  });
});
