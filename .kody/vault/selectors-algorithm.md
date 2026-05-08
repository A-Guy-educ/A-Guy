---
title: Scaling Random Selectors Algorithm
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1449
  - src/server/services/lesson-duplication/selectors.ts
---

# Scaling Random Selectors Algorithm

## Overview

Deterministic random selection with bucket-based scaling for lesson duplication. Zero external dependencies.

## Exports

| Function | Max Items | Seed |
|----------|-----------|------|
| `selectExercisesScaled<T>` | 20 | 42 |
| `selectSectionsScaled<T>` | 5 | 137 |
| `selectScaled<T>` (internal) | configurable | configurable |

## Algorithm: `selectScaled<T>`

```
input: items[], max, seed
output: selected[]

1. Calculate buckets: ceil(length / max)
2. PRNG state = seed
3. For each bucket:
   a. Compute items in bucket
   b. Pick random float [0, 1)
   c. Map to index within bucket
   d. Add to selection (preserving original order)
4. Return selection
```

### Example: n=90, max=20

- Buckets: [0-4], [5-9], [10-14], [15-19], ..., [85-89]
- One selection per bucket, evenly distributed across input

### Properties

- **Deterministic**: Same seed → same output every call
- **Order preserved**: Selection maintains original array order
- **Even spread**: Buckets ensure selection covers entire input range
- **Immutable**: Returns new array, original unchanged

## PRNG: Mulberry32

Inline implementation (no dependencies):

```typescript
function nextFloat(state: number): [number, number] {
  let s = state
  return [
    (s >>>= 0) / 0xffffffff,
    (s = (s + 0x6d2b79f5) | 0)
  ]
}
```

## Tests

23 unit tests covering:
- Bucket boundaries
- Cap enforcement
- Order preservation
- Immutability
- Reproducibility
- Empty input
- Zero/negative max

Coverage: **100% statements, branches, functions, lines**.

## Related

- [lesson-duplication](./lesson-duplication.md)
