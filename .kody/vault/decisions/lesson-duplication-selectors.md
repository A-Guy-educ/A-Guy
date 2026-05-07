---
title: Lesson Duplication Selectors
type: decision
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1449
---

# Lesson Duplication Selectors

**Status:** Implemented — PR #1449

## What

Pure utility module `src/server/services/lesson-duplication/selectors.ts` with two exported functions:

| Function | Max | Seed | Purpose |
|----------|-----|------|---------|
| `selectExercisesScaled<T>` | 20 | 42 | Cap exercises per lesson clone |
| `selectSectionsScaled<T>` | 5 | 137 | Cap content sections per lesson |

Both delegate to the internal `selectScaled<T>` algorithm.

## Algorithm

Uses **inline mulberry32 PRNG** (zero dependencies). Deterministic per-call reproducibility — same inputs always produce same outputs, enabling reproducible test fixtures.

`selectScaled`:
1. Maps items to buckets (items/buckets with last bucket possibly smaller)
2. Selects one random item per bucket via mulberry32
3. Preserves insertion order of selected items

## Coverage

`selectors.ts`: **100% statements, 100% branches, 100% functions, 100% lines** (23 tests).

## TypeScript Fix

`nextFloat` had a tuple-destructuring bug (`let [, s] = state`) — corrected to `let s = state[0]`.

## Related

- [Lesson Duplication](./lesson-duplication.md)
