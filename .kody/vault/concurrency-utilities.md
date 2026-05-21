---
title: Concurrency Utilities
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1447
  - src/infra/utils/concurrency.ts
---

# Concurrency Utilities

## Overview

Counting semaphore utility for bounded parallelism in async operations.

## `withConcurrencyLimit`

```typescript
withConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  factory: (item: T, index: number) => Promise<R>
): Promise<R[]>
```

### Key Behavior

- **Counting semaphore**: Limits concurrent in-flight operations
- **Deferred creation**: Promise for each item created only when a slot is free (not upfront)
- **Stable ordering**: Results always match input order regardless of completion order
- **Error propagation**: Rejects on first error (standard `Promise.all` behavior)

### Problem Solved

Eager `.map()` + batched `Promise.all` pattern:

```typescript
// WRONG: Creates all promises upfront
const promises = items.map(item => processItem(item))
await Promise.all(promises) // All N tasks start immediately
```

With `withConcurrencyLimit`:

```typescript
// CORRECT: Only `limit` tasks run at once
await withConcurrencyLimit(items, 2, processItem)
```

## Usage in Memory Extraction

`CONCURRENCY_LIMIT = 2` for similarity searches:

```typescript
await withConcurrencyLimit(
  embeddingResults,
  CONCURRENCY_LIMIT,
  async (result, idx) => {
    // similarity search per embedding
  }
)
```

## Tests

7 unit tests:
- Max concurrency ≤ limit
- Stable result ordering
- Error propagation
- Empty array
- Sequential (limit=1)
- All-start (limit ≥ length)

## Related

- [memory-extraction](./memory-extraction.md)
