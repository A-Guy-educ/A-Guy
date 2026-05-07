---
title: Memory Extraction Concurrency
type: decision
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1447
---

# Memory Extraction Concurrency

**Status:** Implemented — PR #1447

## Problem

The memory extraction pipeline performed eager embedding lookups (`.map()` → `Promise.all`), which created all embedding tasks simultaneously. With a large memory item set, this saturated the MongoDB connection pool and caused `MongoNetworkTimeoutError`.

## Solution

`withConcurrencyLimit<T, R>(items, limit, factory)` — a counting-semaphore utility in `src/infra/utils/concurrency.ts` that defers promise creation until a slot is free, guaranteeing bounded parallelism.

The memory extraction step now uses `withConcurrencyLimit(embeddingResults, CONCURRENCY_LIMIT = 2, async ...)`, passing through the existing `.catch()` block for graceful degradation.

## Key Design Points

- Deferred promise creation: tasks are only started when a concurrency slot opens
- Graceful degradation: failures in individual lookups don't crash the batch
- `CONCURRENCY_LIMIT = 2` is a module-level constant (readable by pool-guardrail tests)

## Related

- `src/infra/utils/concurrency.ts` — the utility
- `src/infra/llm/memory-extraction.ts` — the consumer
