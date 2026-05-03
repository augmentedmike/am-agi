# Context Graph — Research & Design

**Date:** 2026-03-30
**Status:** Research / Pre-design

---

## What Is It?

A **context graph** is a persistent, agent-maintained knowledge graph of everything the agent encounters across all projects, conversations, and tasks. It answers the question:

> "What do I know about X, and how does X relate to everything else?"

Unlike memory (which is narrative/episodic) and the KB (which is document-centric), the context graph is **entity-centric and relational**. It is the agent's model of the world.

---

## The Gap It Fills

| Layer | What it stores | Unit | Query style |
|---|---|---|---|
| **Board** | Work to do | Cards + states | What needs to happen? |
| **Memory** | Lessons, rules, context | Prose notes | What did I learn? |
| **KB** | Reference documents | Files, embeddings | What does this doc say? |
| **Context Graph** | Entities + relationships | Nodes + edges | Who/what is X? How is X connected to Y? |

Without the context graph, the agent re-discovers the same facts about people, companies, and things from scratch every session. With it, knowledge accumulates and cross-references automatically.

---

## Core Concepts

### Entities (Nodes)

Every entity has:
- `id` — UUID
- `type` — see taxonomy below
- `name` — canonical name
- `aliases` — alternate names, handles, abbreviations
- `summary` — short agent-generated description
- `properties` — flexible JSON bag (email, url, role, founded_date, etc.)
- `confidence` — how certain the agent is (0.0–1.0)
- `source` — where this was learned (card ID, chat message, URL, etc.)
- `created_at`, `updated_at`
- `embedding` — vector for semantic lookup

### Entity Taxonomy

```
Person
  → Employee, Candidate, Contact, User

Organization
  → Company, Team, Community, Institution

Product
  → Software, Hardware, Service, Platform

Project
  → Internal, External, OpenSource

Event
  → Meeting, Release, Conference, Deadline

Place
  → City, Country, Address, Office

Concept
  → Technology, Framework, Methodology, Domain

Document
  → Article, Spec, Contract, Report

Date / Period
  → PointInTime, Span, Deadline, Milestone
```

### Relationships (Edges)

Every edge has:
- `from_id`, `to_id`
- `relation` — typed relationship (see below)
- `weight` — 0.0–1.0 (strength/confidence)
- `properties` — context JSON
- `source` — where this relationship was learned
- `created_at`

### Relationship Taxonomy

```
Structural
  works_at, member_of, owns, part_of, reports_to, founded

Temporal
  started_on, ended_on, happened_at, scheduled_for

Causal / Logical
  depends_on, blocks, caused_by, resulted_in

Informational
  mentioned_in, documented_by, linked_to, authored_by

Social
  knows, collaborated_with, hired, referred_by

Project
  assigned_to, tracked_in, deployed_to, uses_technology
```

---

## Prior Art

### Google Knowledge Graph
Entity cards with confidence scores, inferred from structured data + web crawl. Read-only, enormous scale, no agent integration.

### Wikidata / DBpedia
Open structured knowledge base. Wikidata has ~100M items, all with typed properties. Very useful as a **seed/bootstrap** source — look up known entities before creating new ones.

### Roam Research / Logseq
Block-level graph where every `[[reference]]` creates a graph edge. Shows that a **lightweight link-as-edge model** can build deep graphs from normal writing without a formal schema.

### Microsoft GraphRAG
Builds a knowledge graph from documents for retrieval augmentation. The agent reads docs → extracts entities + relationships → stores in graph → uses graph for context window packing. Directly applicable here.

### Memgraph / Neo4j
Purpose-built graph databases. Powerful but heavyweight. Neo4j's desktop edition is a common choice for personal knowledge graphs.

### LlamaIndex Property Graph
Recent (2024) addition to LlamaIndex: extracts entity-relation triples from text, stores in a property graph, enables graph-enhanced RAG. Uses SQLite + networkx for lightweight local deployment.

### Personal Knowledge Graphs (PKG)
Academic research area (2022–2025). Key insight: **personal graphs are sparse, noisy, and agent-assisted** — unlike enterprise KGs which are curated by humans. Automatic extraction + human review loop is the right model.

---

## Architecture Options

### Option A: SQLite with Adjacency Tables (Recommended for AM)

Use the existing SQLite database (`board.db`). Two tables: `entities` and `relations`.

```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT,          -- JSON array
  summary TEXT,
  properties TEXT,       -- JSON object
  confidence REAL DEFAULT 1.0,
  source TEXT,
  embedding BLOB,        -- via sqlite-vec
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE relations (
  id TEXT PRIMARY KEY,
  from_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  to_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  properties TEXT,
  source TEXT,
  created_at TEXT
);

CREATE INDEX entities_type ON entities(type);
CREATE INDEX entities_name ON entities(name COLLATE NOCASE);
CREATE INDEX relations_from ON relations(from_id);
CREATE INDEX relations_to ON relations(to_id);
CREATE VIRTUAL TABLE entities_fts USING fts5(name, aliases, summary, content=entities);
```

**Pros:** No new dependencies. sqlite-vec gives semantic search. FTS5 gives text search. Queries are fast for graphs with < 1M nodes.
**Cons:** Complex traversal queries in SQL (CTEs required for multi-hop). No built-in graph algorithms.

### Option B: SQLite + networkx in Python

Store entities/relations in SQLite, load into `networkx` for graph traversal, pagerank, community detection, shortest path queries.

**Pros:** Rich graph algorithms. Fast for in-memory analysis.
**Cons:** Python process required for graph ops. Adds a dependency.

### Option C: DuckDB with graph extensions

DuckDB's `duckpgq` extension adds property graph queries (SQL/PGQ). Fast analytical queries on large graphs. Single-file like SQLite.

**Pros:** Proper graph query syntax. Fast for analytical workloads.
**Cons:** Less mature, larger binary, not as well integrated with existing stack.

### Option D: Dedicated Graph DB (Neo4j, Memgraph)

Proper graph databases with Cypher query language.

**Pros:** Best-in-class graph traversal, native graph algorithms, visual exploration.
**Cons:** Separate process, memory overhead, another service to manage.

**Recommendation: Option A** (SQLite + sqlite-vec) with optional networkx for analysis. Zero new infrastructure, aligns with existing patterns.

---

## Extraction Pipeline

How entities and relationships get into the graph:

### 1. Agent-Driven (Primary)
When the agent completes an iteration, it runs an **extraction pass** on the text it processed:

```
text → LLM extract → [entity list] + [relation list] → merge into graph
```

Extract prompt example:
```
Given this text, extract entities and relationships.
Output JSON: { entities: [{name, type, summary, properties}], relations: [{from, to, relation, weight}] }
Only extract entities that are explicitly mentioned. Confidence reflects textual certainty.
```

### 2. Import / Ingest
- **Email sync**: contacts → Person entities, orgs → Organization entities
- **Card creation**: card titles/descriptions → concepts, people mentioned
- **Chat messages**: entities mentioned in chat → extracted passively
- **URL ingestion**: web pages → entities via structured data (JSON-LD, Open Graph)

### 3. Manual
- Agent or user creates entities explicitly: `graph add person "Alice Chen" --role "Engineering Lead at Acme"`
- Merge/link: `graph merge <id1> <id2>` — deduplicate

### 4. Wikidata Bootstrap
For well-known entities (companies, technologies, public figures), seed properties from Wikidata before filling in personal context.

---

## Deduplication & Merging

The hardest part. Same entity appears as "Apple", "Apple Inc.", "AAPL", "apple.com".

Strategy:
1. **Exact match** on canonical name (case-insensitive)
2. **Alias match** — check aliases array
3. **Embedding similarity** — cosine similarity > 0.92 → candidate for merge
4. **Structural signals** — same URL, email, phone → high confidence merge
5. **Human-in-loop** — agent surfaces low-confidence candidates; user confirms

---

## Query Interface

### Natural Language (via agent)
```
"Who works at Acme Corp?"
"What projects use React?"
"Show me everything connected to Alice Chen"
"Which companies has Mike interviewed at in 2025?"
```

### CLI
```sh
graph search "alice"           # FTS + embedding search
graph get <id>                 # Show entity + all relations
graph neighbors <id> [--depth 2]  # Traversal
graph add <type> "<name>"      # Create entity
graph relate <id1> <relation> <id2>  # Create edge
graph merge <id1> <id2>        # Deduplicate
graph export --format json     # Dump for visualization
```

### API
```
GET  /api/graph/search?q=alice&type=person
GET  /api/graph/entities/:id
GET  /api/graph/entities/:id/neighbors?depth=2
POST /api/graph/entities
POST /api/graph/relations
```

---

## CRM as a View

The contacts/CRM system is simply a **filtered view** of the context graph:

```
CRM People = entities WHERE type = 'Person' ORDER BY relation_count DESC
CRM Companies = entities WHERE type = 'Organization'
CRM Pipeline = entities WHERE type = 'Person' AND properties->>'crm_stage' IS NOT NULL
```

Relationship timeline:
```
graph neighbors <person_id> --type Event,Project,Document ORDER BY created_at
```

This gives a complete relationship history for any contact — what projects they're on, what emails were exchanged, what meetings happened, what was discussed — all without separate CRM tables.

---

## Integration with Existing Systems

### Board → Graph
When a card is created/updated:
- Extract entities from title + description + work logs
- Link card to entities: `card_id → mentions → entity_id`
- When a card is shipped: mark relationships as confirmed

### Memory → Graph
When a memory is saved:
- Extract named entities mentioned
- Link memory to entities for entity-specific recall
- `memory recall "alice"` → fetch entity → fetch linked memories

### Chat → Graph
- Passive extraction from chat messages
- `[[person:alice]]` syntax → explicit entity links
- Chat history becomes entity-indexed

### Email → Graph
- Sender/recipient → Person entities
- Org from domain → Organization entity
- Subject + body → extract mentions
- Email thread → linked to entities involved

---

## Visualization

The graph is naturally visualizable. Options:
- **D3 force-directed** — interactive in-browser, renders nodes/edges
- **Cytoscape.js** — more polished, good for sparse graphs
- **Graphviz** — static SVG output for reports

In the board UI: a "Graph" panel (alongside Files, Git) that renders the project's entity neighborhood.

---

## Privacy & Scope

The context graph is **local-first and private by default**:
- Stored in `board.db` alongside everything else
- Never synced to external services without explicit export
- Entities have a `scope` field: `personal | project | public`
- Personal entities (people, private orgs) are never included in public exports

---

## Implementation Phases

### Phase 1 — Foundation (DB + CLI)
- Schema: `entities` + `relations` tables in board.db
- FTS5 index on name/aliases/summary
- CLI: `graph add`, `graph search`, `graph get`, `graph relate`
- API: CRUD endpoints
- Basic deduplication (exact + alias)

### Phase 2 — Extraction
- LLM extraction from card text on ship
- Email sync integration (person + org entities)
- Chat message extraction (passive)

### Phase 3 — Semantic Search
- sqlite-vec embeddings on entity summaries
- Hybrid search: FTS + vector
- Deduplication via embedding similarity

### Phase 4 — CRM View
- Board UI panel: contact list = Person entities
- Entity detail view: timeline of all linked events/cards/emails
- CRM pipeline stage as entity property

### Phase 5 — Graph Visualization
- D3 force-directed graph in UI
- Project entity neighborhood view
- Shortest path between two entities

---

## Open Questions

1. **Extraction granularity** — do we extract from every agent message in real-time, or batch on card ship? Real-time is richer but noisier.

2. **Entity resolution at scale** — embedding-based dedup works for hundreds of entities, but at 10k+ entities it needs approximate nearest-neighbor search.

3. **Relationship directionality** — some relations are symmetric (`knows`), others are directed (`works_at`). Schema should encode this.

4. **Temporal versioning** — "Alice worked at Acme from 2020–2023" means a relation has a time range, not just a creation date. Needs a `valid_from`/`valid_to` on relations.

5. **Confidence decay** — information from 3 years ago may be stale. Confidence should decay over time unless re-confirmed.

6. **Graph as context injection** — when the agent starts a task mentioning known entities, inject their graph neighborhood into the context window. Need to measure token cost.

---

## References

- [Microsoft GraphRAG](https://github.com/microsoft/graphrag) — LLM-based graph construction from docs
- [LlamaIndex Property Graph](https://docs.llamaindex.ai/en/stable/module_guides/indexing/lpg_index_guide/) — lightweight graph index
- [Personal Knowledge Graphs survey (2023)](https://arxiv.org/abs/2304.09572)
- [Wikidata API](https://www.wikidata.org/wiki/Wikidata:Data_access) — entity bootstrapping
- [sqlite-vec](https://github.com/asg017/sqlite-vec) — already in the stack
- [DuckDB pgq extension](https://duckdb.org/2023/04/19/duckpgq-announcement.html)
- [Cytoscape.js](https://js.cytoscape.org/) — graph visualization
