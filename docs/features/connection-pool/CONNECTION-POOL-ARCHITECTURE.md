# MongoDB Connection Pool Architecture

## Overview

This document explains how MongoDB connections are managed in the A-Guy platform, deployed on Vercel serverless with an Atlas Flex tier cluster.

## The Constraint

**Atlas Flex tier limit: 500 total connections.**

In a serverless environment, every cold start creates a new function instance with its own MongoDB connection pool. The total connections across all instances must stay below 500.

```
Total connections = (instances) x (maxPoolSize) + (monitoring connections)
```

Each instance also maintains 1-3 monitoring connections (topology heartbeats) outside the pool, so the real per-instance cost is `maxPoolSize + ~1`.

## Configuration

Connection pool settings are in `src/payload.config.ts`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `maxPoolSize` | 3 (prod), 5 (test) | Max connections per instance. At 3, supports ~166 instances |
| `minPoolSize` | 0 | Pool drains to zero when idle |
| `maxIdleTimeMS` | 10,000ms | Idle connections closed after 10 seconds |
| `connectTimeoutMS` | 5,000ms | Fail fast if Atlas is unreachable |
| `serverSelectionTimeoutMS` | 5,000ms | Fail fast when no server available |
| `waitQueueTimeoutMS` | 3,000ms | Fail fast when pool is saturated |
| `socketTimeoutMS` | 30,000ms | Timeout for long-running operations |

Override via environment variable: `MONGODB_MAX_POOL_SIZE=N`

## Incident History

| Date | maxPoolSize | Max Instances | What Happened |
|------|-------------|---------------|---------------|
| Early 2026 | 100 | 5 | Outage - pool exhausted immediately |
| Apr 9, 2026 | 10 | 50 | Atlas alert at 100% connections |
| Apr 16, 2026 | 3 | 166 | Still hitting 80% during traffic spikes |
| Apr 19, 2026 | 3 + concurrency fixes | 166 | Reduced per-instance pressure |

## Root Causes Found

### 1. Pool size too high (fixed in PR #1240)
`maxPoolSize` was increased from 2 to 10 for cold-start performance, reducing safe instances from 250 to 50.

### 2. Parallel DB operations exceeding pool size (fixed in PR #1271)
Even with `maxPoolSize=3`, code paths ran more parallel operations than the pool could handle:

- **Memory extraction**: `CONCURRENCY_LIMIT=5` ran 5 parallel vector similarity checks per chat message (background). Reduced to 2.
- **Vector search retrieval**: 3 parallel `$vectorSearch` aggregations per chat message. Split into 2 phases (2 parallel + 1 sequential).
- **Course syllabus**: Unbounded `Promise.all` over all chapters (10+). Batched to groups of 2.

### 3. No fail-fast timeouts (fixed in PR #1271)
Without `serverSelectionTimeoutMS` and `waitQueueTimeoutMS`, saturated pools caused requests to queue indefinitely, leading to cascading timeouts in serverless functions.

## How Idle Draining Works

The MongoDB Node.js driver (v6.18+) runs a background timer that prunes idle connections:

1. Connection finishes a query and is returned to the pool
2. After `maxIdleTimeMS` (10s) with no new queries, the connection is destroyed
3. With `minPoolSize=0`, the pool drains to zero connections
4. New queries create fresh connections on demand

The warmup cron (`/api/cron/warmup`, every 4 min) keeps function instances alive but does NOT touch the database, so idle connections still drain.

## Guardrail Tests

`tests/unit/mongodb-pool-config.test.ts` prevents regressions:

1. **Source code scan**: Fails if production `maxPoolSize` default exceeds 5
2. **Capacity math**: Verifies 100+ instances fit under 80% of Atlas limit
3. **Concurrency scan**: Scans all `src/` files for `CONCURRENCY_LIMIT` constants and fails if any exceed `maxPoolSize`
4. **Timeout check**: Verifies `serverSelectionTimeoutMS` and `waitQueueTimeoutMS` are configured

## Health Endpoint

`GET /api/health` returns real-time pool stats:

```json
{
  "ok": true,
  "checks": { "database": true },
  "pool": {
    "maxPoolSize": 3,
    "totalConnections": 2,
    "available": 1,
    "inUse": 1,
    "waitQueueSize": 0
  }
}
```

Use this to monitor connection pressure per instance.

## Rules for Contributors

1. **Never increase `maxPoolSize`** without updating the guardrail test and this document
2. **Keep parallel DB operations at or below `maxPoolSize`** (currently 3). Use batching for larger workloads
3. **Use `CONCURRENCY_LIMIT` as the variable name** for DB concurrency caps so the guardrail test can detect them
4. **Don't create direct MongoDB connections** — always go through Payload's `getPayload()` which uses the shared pool
5. **Background tasks that run DB queries** (like memory extraction) must respect pool limits even though they run after the response is sent
