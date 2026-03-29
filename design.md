# Database Isolation Model and Partitioning Strategy

Version: 1.0
Date: 2026-03-29
Status: Approved for implementation

---

## 1. Primary Isolation Model (Criterion 1)

**Chosen model: Shared Database / Shared Schema with Row-Level Security + Declarative Partitioning**

### Rationale

| Factor | Decision driver |
|--------|----------------|
| **Tenant count** | Expected to start at 10–200 tenants and grow to 10,000+ over 3 years. Separate-schema breaks at ~500 tenants (pg_catalog relation limit). Shared-schema scales unboundedly. |
| **Team size** | Small engineering team (≤10). A separate-database model would require dedicated DevOps capacity for provisioning, monitoring, and migrating hundreds of instances — operationally untenable at this stage. |
| **Compliance** | Standard tenants have no HIPAA/SOC2-Type-II requirements at launch. RLS + partitioning meets standard data segregation obligations. Enterprise tenants requiring hard compliance isolation are handled by tier promotion (see §2). |
| **Cost** | Shared infrastructure is ~100× cheaper per tenant than per-tenant DB instances. The business model requires a free/starter plan; per-tenant DBs make that uneconomical. |
| **Migration path** | Partitioning by `tenant_id` (LIST) enables zero-copy promotion to a dedicated database via partition detach + logical replication. The architecture does not lock any tenant in permanently. |

**Explicit trade-offs accepted:**
- Noisy-neighbour risk is present but mitigated by partitioning (independent VACUUM, connection limits per tenant enforced at app layer) and PgBouncer pool sizing.
- Blast radius on a query bug touches all tenants — mitigated by RLS as a defence-in-depth layer at the storage engine, not just the application.
- No per-tenant PITR out of the box — acceptable for standard tier; enterprise tier provides this.

---

## 2. Tiered Isolation Plan (Criterion 2)

Three tiers are defined. The `tenants` routing table (§6) makes tier promotion a data change — no code changes required.

### Tier 0 — Standard (Free / Pro)
| Property | Value |
|----------|-------|
| Model | Shared DB / Shared Schema |
| Isolation mechanism | RLS policies + `tenant_id`-leading indexes + LIST partitioning |
| Backup | Cluster-level pg_basebackup; per-tenant logical dump via `pg_dump --table=<partition>` |
| PITR | Cluster-level WAL archiving |
| Compliance | Standard GDPR (row deletion by tenant_id) |
| Cost | ~$0.01–$0.05 / tenant / month |

### Tier 1 — Business (Shared DB / Separate Schema)
| Property | Value |
|----------|-------|
| Model | Shared DB, dedicated PostgreSQL schema per tenant (`tenant_<id>`) |
| Isolation mechanism | `search_path` routing; no cross-schema foreign keys |
| Backup | Schema-level `pg_dump -n tenant_<id>` |
| PITR | Cluster-level |
| Compliance | Stronger logical isolation; suitable for light SOC2 requirements |
| Cost | ~$0.50 / tenant / month (schema management overhead) |
| Ceiling | Max ~500 tenants per cluster before pg_catalog pressure |

### Tier 2 — Enterprise (Dedicated Database)
| Property | Value |
|----------|-------|
| Model | Dedicated PostgreSQL instance per tenant |
| Isolation mechanism | Network, OS, and storage isolation |
| Backup | Per-tenant pg_basebackup + WAL; independent PITR window |
| Compliance | HIPAA, SOC2-Type-II, FedRAMP-ready |
| Cost | $50–$500 / tenant / month depending on instance size |

### Promotion Path

```
Tier 0 → Tier 1 (standard → business)
  1. Create schema `tenant_<id>` in the shared cluster
  2. pg_dump --table=<all per-tenant partitions> | psql -n tenant_<id>
  3. Update tenants routing row: schema_name = 'tenant_<id>'
  4. Drop source partition after verification window

Tier 0/1 → Tier 2 (any → enterprise)
  See §7 (logical replication migration workflow)
```

---

## 3. RLS Implementation Specification (Criterion 3)

### Tables requiring RLS

Every table that stores tenant-owned data. At minimum:

| Table | Policies required |
|-------|------------------|
| `tenants` | SELECT (own row only), no INSERT/UPDATE via app role |
| `users` | SELECT, INSERT, UPDATE, DELETE |
| `sessions` | SELECT, INSERT, DELETE |
| `orders` | SELECT, INSERT, UPDATE, DELETE |
| `order_items` | SELECT, INSERT, UPDATE, DELETE |
| `events` | SELECT, INSERT |
| `audit_log` | SELECT, INSERT (append-only; no UPDATE/DELETE) |
| `files` | SELECT, INSERT, UPDATE, DELETE |
| `invoices` | SELECT, INSERT, UPDATE |
| `subscriptions` | SELECT, INSERT, UPDATE |

Internal / system tables (`schema_migrations`, `pgbouncer_pools`, `_cron_jobs`) are **excluded** — they are not tenant-scoped.

### Session variable strategy

The application sets tenant context at transaction start:

```sql
-- In transaction-mode pool (PgBouncer): use SET LOCAL, never SET
SET LOCAL app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';
```

Policies reference:
```sql
current_setting('app.current_tenant_id')::UUID
```

The application role (`app_user`) **must not** have `BYPASSRLS`. A separate `admin_user` role (used only for migrations) may use `BYPASSRLS` but must never be exposed to the application connection pool.

### Required policy types

All four DML operations are covered independently. Template:

```sql
-- Enable and force RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY orders_tenant_select ON orders
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- INSERT
CREATE POLICY orders_tenant_insert ON orders
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- UPDATE
CREATE POLICY orders_tenant_update ON orders
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- DELETE
CREATE POLICY orders_tenant_delete ON orders
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

`FORCE ROW LEVEL SECURITY` is **mandatory** on every RLS table — without it, the table owner (typically the migration role) bypasses all policies.

---

## 4. Partitioning Strategy (Criterion 4)

### Partition key

Primary: `tenant_id` via `PARTITION BY LIST` on high-volume tables.
Secondary (for large tenants): sub-partition by `RANGE (created_at)` or `RANGE (occurred_at)`.

### High-volume tables to partition

| Table | Partition type | Sub-partition |
|-------|---------------|--------------|
| `orders` | LIST (tenant_id) | RANGE (created_at) for tenants > 1M rows |
| `events` | LIST (tenant_id) | RANGE (occurred_at) always (events grow unboundedly) |
| `audit_log` | LIST (tenant_id) | RANGE (created_at) |
| `order_items` | LIST (tenant_id) | None initially |
| `files` | LIST (tenant_id) | None initially |

Low-volume tables (`users`, `sessions`, `tenants`, `subscriptions`, `invoices`) are **not partitioned** — the overhead is not warranted. RLS policies provide sufficient isolation.

### DDL pattern

```sql
-- Parent (partitioned)
CREATE TABLE orders (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL,
  status      TEXT        NOT NULL,
  total       NUMERIC(12,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)    -- tenant_id must be in PK for partitioned tables
) PARTITION BY LIST (tenant_id);

-- Per-tenant partition (created at onboarding)
CREATE TABLE orders_tenant_550e8400 PARTITION OF orders
  FOR VALUES IN ('550e8400-e29b-41d4-a716-446655440000');

-- Default partition (catches new tenants before dedicated partition is created)
CREATE TABLE orders_default PARTITION OF orders DEFAULT;
```

### Default partition handling

New tenants land in the DEFAULT partition immediately upon row insert (no onboarding race condition). A background job runs within 60 seconds of tenant creation:

1. `ALTER TABLE orders DETACH PARTITION orders_default;`
2. `CREATE TABLE orders_tenant_<id> PARTITION OF orders FOR VALUES IN ('<id>');`
3. `INSERT INTO orders_tenant_<id> SELECT * FROM orders_default WHERE tenant_id = '<id>';`
4. `DELETE FROM orders_default WHERE tenant_id = '<id>';`
5. `ALTER TABLE orders ATTACH PARTITION orders_default DEFAULT;`

This ensures every active tenant gets its own partition within one minute of creation, without blocking writes.

---

## 5. Index Strategy (Criterion 5)

**Rule:** All composite indexes on shared-schema tables **lead with `tenant_id`.**
This ensures partition pruning and RLS predicate injection both hit the index.

### Required index definitions — primary multi-tenant tables

```sql
-- orders
CREATE INDEX idx_orders_tenant_status
  ON orders (tenant_id, status, created_at DESC);

CREATE INDEX idx_orders_tenant_created
  ON orders (tenant_id, created_at DESC);

-- order_items
CREATE INDEX idx_order_items_tenant_order
  ON order_items (tenant_id, order_id);

-- events
CREATE INDEX idx_events_tenant_type_occurred
  ON events (tenant_id, event_type, occurred_at DESC);

CREATE INDEX idx_events_tenant_occurred
  ON events (tenant_id, occurred_at DESC);

-- audit_log
CREATE INDEX idx_audit_log_tenant_created
  ON audit_log (tenant_id, created_at DESC);

CREATE INDEX idx_audit_log_tenant_actor
  ON audit_log (tenant_id, actor_id, created_at DESC);

-- users
CREATE UNIQUE INDEX idx_users_tenant_email
  ON users (tenant_id, email);

CREATE INDEX idx_users_tenant_created
  ON users (tenant_id, created_at DESC);

-- files
CREATE INDEX idx_files_tenant_parent
  ON files (tenant_id, parent_id, created_at DESC);
```

**Indexes are created on the parent table** — PostgreSQL automatically propagates them to all partitions and any future partitions created via `PARTITION OF`.

Single-column indexes on `id` (UUID primary key) are declared as `(tenant_id, id)` to remain partition-compatible; the partition key must be a prefix.

---

## 6. Tenant Routing Table (Criterion 6)

The routing table is the central control plane. It exists from day one so that tier promotion is a pure data mutation — no code change, no deployment.

```sql
CREATE TABLE tenants (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT        NOT NULL UNIQUE,           -- URL-safe name
  display_name      TEXT        NOT NULL,
  tier              TEXT        NOT NULL DEFAULT 'standard'
                    CHECK (tier IN ('standard', 'business', 'enterprise')),

  -- Routing fields: null = use shared cluster defaults
  db_connection_string  TEXT    NULL,   -- null → use shared pool DSN
  schema_name           TEXT    NOT NULL DEFAULT 'public',

  -- Lifecycle
  status            TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'migrating', 'archived')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Limits (enforced at app layer, not DB layer)
  max_users         INT         NOT NULL DEFAULT 5,
  max_storage_bytes BIGINT      NOT NULL DEFAULT 5368709120   -- 5 GiB
);

-- Fast slug lookup (used on every request for routing)
CREATE UNIQUE INDEX idx_tenants_slug ON tenants (slug);
CREATE INDEX idx_tenants_status ON tenants (status);
```

### Routing logic (pseudocode)

```
function getConnectionForTenant(tenantId):
  row = SELECT db_connection_string, schema_name FROM tenants WHERE id = tenantId
  if row.db_connection_string IS NULL:
    conn = sharedPoolConnection()
    conn.exec("SET LOCAL search_path = public")   -- shared schema
  else:
    conn = dedicatedPool(row.db_connection_string)
    if row.schema_name != 'public':
      conn.exec("SET LOCAL search_path = " + row.schema_name)
  return conn
```

**Tier promotion is a one-row UPDATE:**
```sql
UPDATE tenants
  SET db_connection_string = 'host=enterprise-db-01 ...',
      schema_name           = 'public',
      tier                  = 'enterprise',
      status                = 'active'
WHERE id = '550e8400-...';
```

---

## 7. Tenant Migration Workflow (Criterion 7)

This is the logical replication path for Tier 0/1 → Tier 2 (dedicated database).
Estimated downtime window: 0–30 seconds (quiesce only).

### Pre-conditions
- Target database instance provisioned and reachable
- `wal_level = logical` on source cluster
- Application supports `status = 'migrating'` (returns 503 or queues writes during quiesce)

### Step-by-step

```sql
-- ═══════════════════════════════════════════════
-- PHASE 1: Replicate data to target (live, no downtime)
-- ═══════════════════════════════════════════════

-- 1a. Source cluster: create filtered publication for this tenant
CREATE PUBLICATION tenant_550e8400_pub
  FOR TABLE orders, order_items, events, audit_log, users, sessions,
             files, invoices, subscriptions
  WHERE (tenant_id = '550e8400-e29b-41d4-a716-446655440000');

-- 1b. Target cluster: create matching schema
\i schema.sql  -- apply DDL without RLS/partitioning (single-tenant DB)

-- 1c. Target cluster: subscribe
CREATE SUBSCRIPTION tenant_550e8400_sub
  CONNECTION 'host=source-db port=5432 dbname=app user=replicator password=...'
  PUBLICATION tenant_550e8400_pub;

-- 1d. Monitor replication lag until < 100ms
SELECT
  pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn)) AS send_lag,
  pg_size_pretty(pg_wal_lsn_diff(sent_lsn, replay_lsn))           AS replay_lag
FROM pg_stat_replication
WHERE application_name = 'tenant_550e8400_sub';

-- ═══════════════════════════════════════════════
-- PHASE 2: Quiesce and cut over (brief downtime)
-- ═══════════════════════════════════════════════

-- 2a. Mark tenant as migrating (application returns 503 for this tenant)
UPDATE tenants SET status = 'migrating' WHERE id = '550e8400-...';

-- 2b. Wait for replication lag = 0 bytes / 0ms
-- Poll pg_stat_replication.replay_lag until zero.

-- 2c. Verify row counts match on source and target for each table:
SELECT COUNT(*) FROM orders WHERE tenant_id = '550e8400-...';       -- source
SELECT COUNT(*) FROM orders;                                          -- target

-- 2d. Update routing table → cut over
UPDATE tenants
  SET db_connection_string = 'host=enterprise-db-01 port=5432 dbname=tenant_550e8400 ...',
      schema_name           = 'public',
      tier                  = 'enterprise',
      status                = 'active'
WHERE id = '550e8400-...';

-- Application now routes new connections to dedicated DB.

-- ═══════════════════════════════════════════════
-- PHASE 3: Cleanup (post-cutover)
-- ═══════════════════════════════════════════════

-- 3a. Target: drop subscription (no longer needed)
DROP SUBSCRIPTION tenant_550e8400_sub;

-- 3b. Source: drop publication
DROP PUBLICATION tenant_550e8400_pub;

-- 3c. Source: delete tenant data (optional, after retention window)
-- Use partition detach for clean removal:
ALTER TABLE orders DETACH PARTITION orders_tenant_550e8400;
DROP TABLE orders_tenant_550e8400;
-- Repeat for each partitioned table.

-- 3d. For non-partitioned tables:
DELETE FROM users       WHERE tenant_id = '550e8400-...';
DELETE FROM sessions    WHERE tenant_id = '550e8400-...';
DELETE FROM invoices    WHERE tenant_id = '550e8400-...';
DELETE FROM subscriptions WHERE tenant_id = '550e8400-...';
```

### Rollback path
If issues are detected before step 2d, set `status = 'active'` back and drop the subscription. No data has been lost. After step 2d, rollback requires reverting the routing row and re-establishing replication from target → source.

---

## 8. RLS Safety Checklist (Criterion 8)

This checklist must be verified before any production deployment and after any schema migration.

| # | Check | Verification method |
|---|-------|-------------------|
| 1 | **`FORCE ROW LEVEL SECURITY`** is set on every RLS table | `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relrowsecurity = true;` — confirm `relforcerowsecurity = true` for all rows |
| 2 | **No `BYPASSRLS`** on application role(s) | `SELECT rolname, rolbypassrls FROM pg_roles WHERE rolbypassrls = true;` — only `admin_user` and superusers appear; `app_user` must not appear |
| 3 | **`SET LOCAL`** (not `SET`) used in transaction-mode pools | Audit all connection initialization code paths. PgBouncer `server_reset_query` should include `RESET ALL;` as a safety net. Integration test: set a tenant_id, commit, verify next transaction from same connection sees no tenant context |
| 4 | **`security_barrier = true`** on all views over RLS tables | `SELECT viewname FROM pg_views WHERE definition ILIKE '%orders%';` then confirm: `SELECT relname, reloptions FROM pg_class WHERE relname IN (<view list>);` — `reloptions` must contain `security_barrier=true` |
| 5 | **Cross-tenant leak test** passing in CI | Integration test: create two tenants A and B, insert rows for each, authenticate as tenant A, assert no rows from tenant B visible in any query on any RLS table. Run as part of every CI pipeline. |

### Additional checks (defence in depth)

- [ ] `SECURITY DEFINER` functions audited — none should bypass tenant context
- [ ] No raw SQL in application that bypasses ORM and omits `tenant_id` predicate
- [ ] Database role `app_user` connects with `pg_hba.conf` restricting to app subnets only
- [ ] `search_path` explicitly set on every connection (prevents schema injection attacks)
- [ ] RLS policies reviewed after every `ALTER TABLE` (policy definitions survive column adds but should be re-read)

---

## 9. Schema Migration Strategy Per Tier (Criterion 9)

### Tier 0 — Standard (shared schema, `public`)

All tenants share one schema. A single migration run updates all tenants simultaneously.

**Tool:** Flyway or golang-migrate with sequential versioned migrations (`V001__add_status.sql`).
**Process:**
1. Write migration as a non-blocking DDL (`ADD COLUMN ... DEFAULT NULL`, `CREATE INDEX CONCURRENTLY`).
2. Run via CI/CD migration job against the shared cluster before deploying new application code.
3. Application code handles both old and new schema (expand/contract pattern) during the rollout window.
4. Constraints/NOT NULL are added in a subsequent migration after all app instances are on the new version.

**Key rules:**
- Never `ALTER TABLE ... ADD COLUMN NOT NULL` without a default in a live system — it rewrites the table.
- Always prefer `CREATE INDEX CONCURRENTLY` to avoid table locks.
- RLS policies are applied in the same migration file as the `CREATE TABLE`.

### Tier 1 — Business (per-schema)

Each schema must receive the same migration independently.

**Process:**
1. Migration job iterates `SELECT slug FROM tenants WHERE tier = 'business' AND status = 'active'`.
2. For each: `SET search_path = tenant_<slug>; <migration SQL>; RESET search_path;`
3. Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... IF NOT EXISTS`).
4. Progress tracked in a shared `schema_migrations` table with `(tenant_id, version, applied_at)`.
5. Failed migrations are logged; the job retries with exponential backoff and pages on-call after 3 failures.

**Automation target:** ≤5 minutes to migrate 500 business-tier tenants (use parallel workers, max 10 concurrent).

### Tier 2 — Enterprise (dedicated database)

Each database is independent and migrates on its own schedule.

**Process:**
1. Migration container is deployed to the tenant's database environment (Kubernetes Job or similar).
2. Same migration files as Tier 0 applied via Flyway against the dedicated connection string from the routing table.
3. Enterprise tenants may request a maintenance window for large breaking changes.
4. Routing table `status` is set to `'migrating'` during the migration; application returns 503 for that tenant.

**Drift detection:** A weekly job diffs `pg_class` schema fingerprints across all enterprise databases against the canonical schema. Drift alerts page the engineering team.

---

## 10. Operational Concerns (Criterion 10)

### Connection Pooling — PgBouncer

**Mode:** Transaction mode (`pool_mode = transaction`) — required for RLS with `SET LOCAL`.
Session mode is **not used** (incompatible with horizontal scaling).

```ini
# pgbouncer.ini (relevant sections)
[pgbouncer]
pool_mode = transaction
max_client_conn = 10000
default_pool_size = 20         ; per application user+database pair
reserve_pool_size = 5
reserve_pool_timeout = 3

# CRITICAL: reset session state between transactions
server_reset_query = DISCARD ALL;
# Alternative if DISCARD ALL is too slow:
# server_reset_query = RESET ALL; SET SESSION AUTHORIZATION DEFAULT;

[databases]
app = host=pg-primary port=5432 dbname=app
```

**Application requirements:**
- Always use `SET LOCAL app.current_tenant_id = '...'` inside a transaction block — never bare `SET`.
- Connection wrapper sets tenant context as the first statement in every transaction.
- Never use `LISTEN/NOTIFY`, prepared statements, or advisory locks in transaction mode (these require session mode and bypass PgBouncer reuse).

### Per-Tenant VACUUM Isolation

LIST partitioning by `tenant_id` provides independent VACUUM/ANALYZE per partition:

- A hot tenant writing 100k rows/second gets autovacuumed on its partition; cold tenants are unaffected.
- `autovacuum_vacuum_scale_factor = 0.01` on high-volume parent tables (triggers more frequent VACUUM).
- Large partitions (>10M rows) get explicit `VACUUM ANALYZE` in a scheduled maintenance window.

```sql
-- Per-partition autovacuum tuning (applied at partition creation)
ALTER TABLE orders_tenant_550e8400
  SET (autovacuum_vacuum_scale_factor = 0.01,
       autovacuum_analyze_scale_factor = 0.005);
```

### Noisy-Neighbour Mitigation

| Layer | Mechanism |
|-------|----------|
| **Connection quota** | PgBouncer `max_user_connections` per tenant role (enforced at app layer by tenant-specific pool limits) |
| **Query timeout** | `statement_timeout = 30s` set on `app_user` role; long-running analytical queries use a separate read-replica role with `statement_timeout = 300s` |
| **Partition pruning** | All queries include `WHERE tenant_id = ?`; without it, the planner scans all partitions. ORM layer enforces tenant scope. |
| **Rate limiting** | Application-layer rate limiter (Redis token bucket) caps requests per tenant. Burst traffic that could flood the DB is shed before reaching PostgreSQL. |
| **Write amplification** | Bulk import jobs run via a background queue (not inline HTTP request); each job is rate-limited to 1,000 INSERTs/second per tenant. |
| **Read replicas** | Analytical / reporting queries are routed to a read replica via the routing layer. The primary handles only transactional workloads. |
| **pg_stat_statements** | Monitored continuously; queries with `mean_exec_time > 500ms` trigger an alert. Per-tenant `pg_stat_statements` attribution is possible by setting `app.current_tenant_id` and filtering `query` text. |

---

## Summary

| Criterion | Decision |
|-----------|----------|
| 1. Isolation model | Shared DB / Shared Schema + RLS + Partitioning |
| 2. Tiered plan | 3 tiers: Standard (shared), Business (schema), Enterprise (dedicated DB) |
| 3. RLS | All tenant tables; `SET LOCAL app.current_tenant_id`; all 4 policy types; FORCE RLS mandatory |
| 4. Partitioning | LIST by tenant_id on orders/events/audit_log/order_items/files; sub-partition by time for events |
| 5. Indexes | All composite indexes lead with tenant_id; defined on parent table |
| 6. Routing table | `tenants` table with `db_connection_string + schema_name`; promotion = one UPDATE |
| 7. Migration path | Logical replication (publish → subscribe → quiesce → verify lag → update routing → cleanup) |
| 8. RLS safety | 5-item checklist + CI cross-tenant leak test |
| 9. Schema migrations | Tier 0: single run; Tier 1: parallel per-schema iterator; Tier 2: per-DB migration container |
| 10. Operations | PgBouncer transaction mode + DISCARD ALL; per-partition autovacuum; rate limiting + query timeouts |
