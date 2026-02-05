# TDD Work Plan: PDF→Exercises Deterministic Dedup

**Version:** 1.0
**Date:** 2026-02-04
**Spec Reference:** [spec.md](./spec.md)

---

## Summary of Fixed Decisions

| Decision     | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Uniqueness   | **Source-based** (page range + position), NOT content-based |
| Merge rule   | **Last write wins** (no "richer wins", no heuristics)       |
| Retry effect | **None** on dedup/merge                                     |
| Scope        | **Exercise-specific** (no generic platform)                 |

---

## Current State Analysis

### Relevant Files

- `src/server/payload/collections/Exercises/index.ts` - Collection schema
- `src/server/payload/jobs/pdf-to-exercises-task.ts` - Conversion job
- `src/server/services/exercise-conversion/helpers.ts` - Helpers (`isContentRicher`, `normalizeExerciseInput`)
- `src/server/utils/hash.ts` - `computeContentHash()`
- `src/server/payload/migrations/003-add-exercise-unique-index.ts` - Current unique index

### Current Identity Model

- **Unique key:** `(lesson, sourceDoc, contentHash)` via MongoDB index
- **Lookup:** Find by `(lessonId, sourceDocId, contentHash)`
- **Merge:** `isContentRicher()` - updates only if new content has more blocks/TikZ

### Problems (from spec)

1. Same content on different pages → incorrectly deduped
2. Minor LLM variations → different `contentHash` → duplicate exercises
3. "Richer wins" merge creates ambiguity with retry flow

---

## Stage 1: Observability Only

### Goal

Compute and log a source-based idempotency key for every extracted exercise. **No behavior change.**

### Tests First

#### Unit Tests: `tests/unit/idempotency-key.test.ts`

```
TEST 1.1: computeIdempotencyKey basic format
  GIVEN tenantId="t1", lessonId="l1", sourceDocId="d1", pageStart=1, pageEnd=3, itemOrdinal=2, specVersion="v1"
  WHEN computeIdempotencyKey() is called
  THEN returns "t1:l1:d1:1-3:2:v1"

TEST 1.2: computeIdempotencyKey is deterministic
  GIVEN identical inputs across multiple calls
  WHEN computeIdempotencyKey() is called twice
  THEN returns identical strings

TEST 1.3: computeIdempotencyKey differs by page range
  GIVEN same content but different (pageStart, pageEnd)
  WHEN computeIdempotencyKey() is called for each
  THEN returns different keys

TEST 1.4: computeIdempotencyKey differs by itemOrdinal
  GIVEN same page range but different itemOrdinal
  WHEN computeIdempotencyKey() is called for each
  THEN returns different keys

TEST 1.5: computeIdempotencyKey differs by specVersion
  GIVEN same everything but different specVersion
  WHEN computeIdempotencyKey() is called for each
  THEN returns different keys
```

#### Integration Test: `tests/int/pdf-conversion-observability.int.test.ts`

```
TEST 1.6: Job output includes proposedIdempotencyKey per exercise
  GIVEN a PDF with 2 exercises on pages 1-3
  WHEN pdf_to_exercises job runs
  THEN job output segments contain debug.proposedIdempotencyKeys array
  AND each key follows format "{tenant}:{lesson}:{doc}:{pStart}-{pEnd}:{ordinal}:v1"

TEST 1.7: Structured log emits idempotency key for each exercise
  GIVEN a PDF with exercises
  WHEN pdf_to_exercises job runs
  THEN console logs contain "[PDF→Exercises] Exercise idempotencyKey=..." entries
```

### Minimal Code Change Scope

1. **New file:** `src/server/services/exercise-conversion/idempotency.ts`
   - Export `computeIdempotencyKey(params): string`
   - Export `SPEC_VERSION = 'v1'`

2. **Modify:** `src/server/payload/jobs/pdf-to-exercises-task.ts`
   - Import `computeIdempotencyKey`
   - After validation, compute key for each exercise
   - Add to segment output: `debug: { proposedIdempotencyKeys: [...] }`
   - Log: `console.log(\`[PDF→Exercises] Exercise idempotencyKey=${key}, contentHash=${hash}\`)`

### Metrics to Verify

| Metric | Description                             | Target                             |
| ------ | --------------------------------------- | ---------------------------------- |
| M1     | `extracted_items_total`                 | Logged per job                     |
| M2     | `extracted_unique_contentHash_count`    | Logged per job                     |
| M3     | `extracted_unique_proposedIdKey_count`  | Logged per job                     |
| M4     | `extracted_collisions_by_proposedIdKey` | ~0 (indicates unstable ordinal)    |
| M5     | `same_contentHash_diff_pageRange_count` | >0 expected for repeated exercises |

### Exit Criteria

- [ ] `computeIdempotencyKey` unit tests pass
- [ ] Integration test confirms keys in job output
- [ ] `exercisesCreated` / `exercisesDeduped` counts unchanged from baseline
- [ ] M4 (collisions) is near zero on test PDFs

### Rollback Mechanism

- Remove logging code and `debug` field from output
- Delete `idempotency.ts` file
- No data migration required

---

## Stage 2: In-Memory Dedup (Segment-Level)

### Goal

Deduplicate extractor output **within a segment** using the idempotency key before DB writes.

### Tests First

#### Unit Tests: `tests/unit/segment-dedup.test.ts`

```
TEST 2.1: deduplicateByIdempotencyKey keeps last occurrence
  GIVEN exercises with same idempotencyKey at indices 0 and 2
  WHEN deduplicateByIdempotencyKey() is called
  THEN returns only exercise at index 2 (last wins)

TEST 2.2: deduplicateByIdempotencyKey preserves unique exercises
  GIVEN 3 exercises with different idempotencyKeys
  WHEN deduplicateByIdempotencyKey() is called
  THEN returns all 3 exercises unchanged

TEST 2.3: deduplicateByIdempotencyKey handles empty array
  GIVEN empty exercises array
  WHEN deduplicateByIdempotencyKey() is called
  THEN returns empty array

TEST 2.4: deduplicateByIdempotencyKey handles single exercise
  GIVEN array with 1 exercise
  WHEN deduplicateByIdempotencyKey() is called
  THEN returns array with that 1 exercise

TEST 2.5: deduplicateByIdempotencyKey returns drop count
  GIVEN 5 exercises with 2 duplicates (3 unique keys)
  WHEN deduplicateByIdempotencyKey() is called
  THEN returns { exercises: [...], droppedCount: 2 }
```

#### Integration Test: `tests/int/pdf-conversion-inmemory-dedup.int.test.ts`

```
TEST 2.6: Segment with duplicate exercises persists only one
  GIVEN extractor returns 2 exercises with identical (pageRange, ordinal)
  WHEN pdf_to_exercises job runs
  THEN only 1 exercise is created in DB
  AND segment output shows inmemory_dedup_dropped_count=1

TEST 2.7: DB write count reduced after dedup
  GIVEN PDF known to produce segment-level duplicates
  WHEN job runs with dedup enabled
  THEN db_write_attempts < extracted_items_total

TEST 2.8: Duplicate key DB errors decrease
  GIVEN scenario that previously caused duplicate key errors
  WHEN job runs with in-memory dedup
  THEN no MongoDB 11000 errors in logs
```

### Minimal Code Change Scope

1. **New function in:** `src/server/services/exercise-conversion/idempotency.ts`

   ```ts
   export function deduplicateByIdempotencyKey(
     exercises: EnrichedExercise[],
     keyFn: (ex: EnrichedExercise) => string,
   ): { exercises: EnrichedExercise[]; droppedCount: number }
   ```

2. **Modify:** `src/server/payload/jobs/pdf-to-exercises-task.ts`
   - After `validateExtractedExercises` and `enrichBlockIds`
   - Call `deduplicateByIdempotencyKey` before persistence loop
   - Add to segment output: `inmemory_dedup_dropped_count`
   - Update `output.exercisesDeduped += droppedCount`

### Metrics to Verify

| Metric | Description                            | Target                     |
| ------ | -------------------------------------- | -------------------------- |
| M6     | `segment_inmemory_dedup_dropped_count` | >0 on known duplicate PDFs |
| M7     | `db_write_attempts` before vs after    | Decrease                   |
| M8     | `duplicate_key_db_errors_count`        | Decrease / zero            |

### Exit Criteria

- [ ] Unit tests for dedup function pass
- [ ] Integration test confirms reduced DB writes
- [ ] M8 (duplicate key errors) decreases on problematic PDFs
- [ ] Total persisted exercises matches expected (no unexpected loss)

### Rollback Mechanism

- Add feature flag: `ENABLE_INMEMORY_DEDUP=false`
- Skip dedup call when flag is false
- No data changes to revert

---

## Stage 3: Shadow Identity Field

### Goal

Persist `idempotencyKey` on Exercise documents **without enforcing uniqueness yet**.

### Tests First

#### Unit Tests: `tests/unit/exercise-schema-idempotency.test.ts`

```
TEST 3.1: Exercise schema accepts idempotencyKey field
  GIVEN valid exercise data with idempotencyKey
  WHEN Payload create() is called
  THEN exercise is created with idempotencyKey stored

TEST 3.2: Exercise schema accepts specVersion field
  GIVEN valid exercise data with specVersion="v1"
  WHEN Payload create() is called
  THEN exercise is created with specVersion stored

TEST 3.3: Exercise schema accepts extractionMeta object
  GIVEN valid exercise data with extractionMeta={ segmentIndex: 0, itemOrdinal: 1 }
  WHEN Payload create() is called
  THEN exercise is created with extractionMeta stored

TEST 3.4: idempotencyKey field is optional (backward compat)
  GIVEN exercise data WITHOUT idempotencyKey
  WHEN Payload create() is called
  THEN exercise is created successfully
```

#### Integration Test: `tests/int/pdf-conversion-shadow-field.int.test.ts`

```
TEST 3.5: New exercises have idempotencyKey populated
  GIVEN PDF conversion job runs
  WHEN exercises are created
  THEN each exercise document has non-null idempotencyKey

TEST 3.6: Updated exercises have idempotencyKey populated
  GIVEN existing exercise from conversion
  WHEN same PDF is re-run (triggers update path)
  THEN exercise idempotencyKey is preserved or updated

TEST 3.7: Existing exercises without idempotencyKey remain readable
  GIVEN legacy exercise created before this feature
  WHEN fetched via Payload API
  THEN returns successfully with idempotencyKey=null
```

### Minimal Code Change Scope

1. **Modify:** `src/server/payload/collections/Exercises/index.ts`
   Add fields to Conversion Metadata collapsible:

   ```ts
   {
     name: 'idempotencyKey',
     type: 'text',
     index: true,  // Non-unique for now
     admin: { description: 'Source-based identity key (tenant:lesson:doc:pages:ordinal:version)' },
   },
   {
     name: 'specVersion',
     type: 'text',
     admin: { description: 'Extraction spec version for idempotency key stability' },
   },
   {
     name: 'extractionMeta',
     type: 'json',
     admin: { description: 'Additional extraction metadata (segmentIndex, itemOrdinal)' },
   },
   ```

2. **Modify:** `src/server/payload/jobs/pdf-to-exercises-task.ts`
   - Compute `idempotencyKey` for each exercise
   - Include in `payload.create()` and `payload.update()` data:
     ```ts
     idempotencyKey: computeIdempotencyKey({...}),
     specVersion: SPEC_VERSION,
     extractionMeta: { segmentIndex: i, itemOrdinal: exercise.orderInSegment },
     ```

3. **Run:** `pnpm generate:types` to update `payload-types.ts`

### Metrics to Verify

| Metric | Description                                         | Target             |
| ------ | --------------------------------------------------- | ------------------ |
| M9     | `exercises_with_idempotencyKey_ratio` (new/updated) | 100%               |
| M10    | `idempotencyKey_null_count` (new writes)            | 0                  |
| M11    | `idempotencyKey_backfill_needed_count` (existing)   | Known legacy count |

### Exit Criteria

- [ ] Schema tests pass
- [ ] Integration tests confirm field population
- [ ] Existing exercises remain readable
- [ ] No breaking changes to existing API responses

### Rollback Mechanism

- Stop writing new fields in job task
- Fields are optional, no migration to undo
- Can drop fields from schema if needed (data remains, just not exposed)

---

## Stage 4: Switch Source of Truth

### Goal

Upsert by `idempotencyKey` with **Last wins** semantics. Re-running same PDF must not increase exercise count.

### Tests First

#### Unit Tests: `tests/unit/last-wins-merge.test.ts`

```
TEST 4.1: Upsert with new idempotencyKey creates exercise
  GIVEN no exercise exists with idempotencyKey="t1:l1:d1:1-3:1:v1"
  WHEN upsertByIdempotencyKey() is called
  THEN new exercise is created

TEST 4.2: Upsert with existing idempotencyKey updates exercise
  GIVEN exercise exists with idempotencyKey="t1:l1:d1:1-3:1:v1"
  WHEN upsertByIdempotencyKey() is called with different content
  THEN existing exercise is updated (last wins)

TEST 4.3: Last wins ignores content richness comparison
  GIVEN existing exercise has 5 blocks
  WHEN upsert called with 2 blocks (less rich content)
  THEN exercise is updated to 2 blocks (no richness check)

TEST 4.4: Last wins updates all content fields
  GIVEN existing exercise with title="Old", content={...}
  WHEN upsert called with title="New", content={...}
  THEN exercise has title="New" and new content
```

#### Integration Test: `tests/int/pdf-conversion-idempotency-upsert.int.test.ts`

```
TEST 4.5: Rerun same PDF produces zero new exercises (create count ~0)
  GIVEN PDF has been converted once, creating 5 exercises
  WHEN same PDF conversion job runs again
  THEN total exercises = 5 (not 10)
  AND creates_count = 0
  AND updates_count = 5

TEST 4.6: Different page ranges store separate exercises
  GIVEN PDF with identical exercise text on page 2 and page 7
  WHEN conversion job runs
  THEN 2 separate exercises exist
  AND they have different idempotencyKeys

TEST 4.7: Unique index prevents duplicates under concurrency
  GIVEN two conversion jobs start simultaneously for same PDF
  WHEN both attempt to create same exercise
  THEN only 1 exercise exists
  AND no uncaught duplicate key errors

TEST 4.8: contentHash still computed for debugging
  GIVEN conversion job runs
  WHEN exercises are created/updated
  THEN contentHash field is populated
  AND contentHash can differ while idempotencyKey is same (LLM variance)
```

### Minimal Code Change Scope

1. **New migration:** `src/server/payload/migrations/004-add-idempotency-key-index.ts`

   ```ts
   // Create unique index on idempotencyKey (single field, not compound)
   await db.collection('exercises').createIndex(
     { idempotencyKey: 1 },
     {
       unique: true,
       sparse: true, // Allow null for legacy docs
       name: 'idx_exercise_idempotency_key_unique',
     },
   )
   ```

2. **Modify:** `src/server/payload/jobs/pdf-to-exercises-task.ts`
   Replace current lookup/create/update logic:

   **Before:**

   ```ts
   // Find by (lessonId, sourceDocId, contentHash)
   const existing = await payload.find({ where: { ... contentHash ... } })
   if (existing.docs.length > 0) {
     if (isContentRicher(...)) { await payload.update(...) }
   } else {
     await payload.create(...)
   }
   ```

   **After:**

   ```ts
   // Find by idempotencyKey
   const idempotencyKey = computeIdempotencyKey({...})
   const existing = await payload.find({
     where: { idempotencyKey: { equals: idempotencyKey } },
     limit: 1
   })

   if (existing.docs.length > 0) {
     // Last wins - always update
     await payload.update({
       id: existing.docs[0].id,
       data: { ...allContentFields, contentHash, updatedAt: new Date() }
     })
     updates++
   } else {
     // Create new
     try {
       await payload.create({ data: { ...allFields, idempotencyKey, contentHash } })
       creates++
     } catch (err) {
       if (isDuplicateKeyError(err)) {
         // Race condition - someone else created it, do update
         await payload.update({ where: { idempotencyKey }, data: {...} })
         updates++
       } else throw err
     }
   }
   ```

3. **Remove:** Call to `isContentRicher()` in persistence logic

### Metrics to Verify

| Metric | Description                          | Target           |
| ------ | ------------------------------------ | ---------------- |
| M12    | `rerun_same_pdf_exercises_delta`     | 0                |
| M13    | `idempotency_upsert_update_count`    | Matches expected |
| M14    | `idempotency_upsert_create_count`    | ~0 on reruns     |
| M15    | `contentHash_change_rate_on_updates` | Informational    |

### Exit Criteria

- [ ] Rerun test: same PDF produces 0 new exercises
- [ ] Different page ranges → separate exercises (sampling verified)
- [ ] Duplicate key errors eliminated
- [ ] All tests pass

### Rollback Mechanism

- Feature flag: `USE_IDEMPOTENCY_KEY_UPSERT=false`
- When false: use old `(lessonId, sourceDocId, contentHash)` lookup
- Keep old index alive until stability confirmed
- Migration is additive (adds index), not destructive

---

## Stage 5: Cleanup (Optional, After Stability)

### Goal

Remove legacy complexity after stability window.

### Tests First

#### Regression Tests: `tests/int/pdf-conversion-cleanup-regression.int.test.ts`

```
TEST 5.1: Conversion still works after removing isContentRicher
  GIVEN updated codebase without isContentRicher function
  WHEN conversion job runs
  THEN exercises are created/updated correctly

TEST 5.2: Conversion works without contentHash unique index
  GIVEN old unique index dropped
  WHEN concurrent conversion jobs run
  THEN no errors, correct exercise count

TEST 5.3: Retry does not affect persistence decision
  GIVEN exercise extraction that retries verification
  WHEN exercise passes on retry
  THEN persistence uses standard last-wins logic
```

### Minimal Code Change Scope

1. **New migration:** `src/server/payload/migrations/005-drop-content-hash-unique-index.ts`

   ```ts
   // Drop old unique index
   await db.collection('exercises').dropIndex('idx_exercise_unique_identity')
   // Keep non-unique index on contentHash for debugging queries
   await db
     .collection('exercises')
     .createIndex({ contentHash: 1 }, { unique: false, name: 'idx_exercise_content_hash' })
   ```

2. **Delete:** `isContentRicher()` from `src/server/services/exercise-conversion/helpers.ts`

3. **Cleanup:** Remove any remaining references to "richer content wins" in comments

4. **Update:** Job output to remove legacy dedup metrics that no longer apply

### Metrics to Verify

| Metric | Description                      | Target      |
| ------ | -------------------------------- | ----------- |
| M16    | `codepath_count_removed`         | Track in PR |
| M17    | `production_duplicate_incidence` | Stable/low  |

### Exit Criteria

- [ ] No regression in conversion success rate
- [ ] No increase in duplicate exercises
- [ ] Code is simpler (fewer branches, no heuristics)

### Rollback Mechanism

- Keep migration plan reversible
- If needed: recreate old unique index (rare)
- Old code paths can be restored from git history

---

## Test File Structure

```
tests/
├── unit/
│   ├── idempotency-key.test.ts          # Stage 1
│   ├── segment-dedup.test.ts            # Stage 2
│   ├── exercise-schema-idempotency.test.ts  # Stage 3
│   └── last-wins-merge.test.ts          # Stage 4
└── int/
    ├── pdf-conversion-observability.int.test.ts     # Stage 1
    ├── pdf-conversion-inmemory-dedup.int.test.ts    # Stage 2
    ├── pdf-conversion-shadow-field.int.test.ts      # Stage 3
    ├── pdf-conversion-idempotency-upsert.int.test.ts  # Stage 4
    └── pdf-conversion-cleanup-regression.int.test.ts  # Stage 5
```

---

## Implementation Order Summary

| Stage | Focus                 | Breaking Change | Feature Flag                 |
| ----- | --------------------- | --------------- | ---------------------------- |
| 1     | Observability         | No              | None needed                  |
| 2     | In-memory dedup       | No              | `ENABLE_INMEMORY_DEDUP`      |
| 3     | Shadow field          | No              | None needed                  |
| 4     | Switch to idempotency | Yes (behavior)  | `USE_IDEMPOTENCY_KEY_UPSERT` |
| 5     | Cleanup               | No              | Migration-gated              |

---

## Appendix: Idempotency Key Format

```
{tenantId}:{lessonId}:{sourceDocId}:{pageStart}-{pageEnd}:{itemOrdinal}:{specVersion}

Example:
abc123:lesson456:doc789:1-3:2:v1
```

### Component Definitions

- **tenantId**: From job input `ctx.tenantId`
- **lessonId**: From job input `ctx.lessonId`
- **sourceDocId**: From job input `ctx.sourceDocId`
- **pageStart-pageEnd**: From segment being processed
- **itemOrdinal**: `exercise.orderInSegment` (1-indexed from extractor)
- **specVersion**: Constant `v1`, bump when extraction contract changes
