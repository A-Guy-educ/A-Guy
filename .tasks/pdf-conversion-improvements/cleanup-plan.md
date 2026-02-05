# Corrected Cleanup Plan: PDF Exercise Deduplication

## Goal

Fix the idempotency-based deduplication system so it actually works. The current system creates duplicates on re-runs because `idempotencyKey` is unstable (based on LLM-derived ordering).

---

## 1. Corrected Cleanup Plan

### Phase A: Fix Idempotency Key Stability (CRITICAL)

- [ ] **A1.** Modify `computeIdempotencyKey()` to use SYSTEM-derived ordinal, not LLM `orderInSegment`
  - Current: `{tenant}:{lesson}:{doc}:{pageStart}-{pageEnd}:{orderInSegment}:{specVersion}`
  - Fixed: `{tenant}:{lesson}:{doc}:{pageStart}-{pageEnd}:{systemOrdinal}:{specVersion}`
  - `systemOrdinal` = array index (0-based or 1-based) from extraction order, NOT LLM field

- [ ] **A2.** Keep LLM `orderInSegment` as metadata only (stored in `sourceOrderInSegment` field)
  - Do NOT use it in identity key

- [ ] **A3.** Update `createIdempotencyKeyFn()` to accept system ordinal parameter

### Phase B: Verify Upsert Logic is Active (CRITICAL)

- [ ] **B1.** Confirm `pdf-to-exercises-task.ts` uses upsert-by-idempotencyKey pattern
  - Find existing by `idempotencyKey` → update if found, create if not

- [ ] **B2.** Verify unique index exists on `idempotencyKey`
  - Index: `idx_exercise_idempotency_key_unique` (sparse, unique)

- [ ] **B3.** Add/verify counters in job output:
  - `exercisesCreated` (new exercises)
  - `exercisesDeduped` (updated existing)
  - Log these per segment and total

### Phase C: Remove Dead Code (SAFE)

- [ ] **C1.** Remove unused `_useIdempotencyUpsert` variable (line 119 of pdf-to-exercises-task.ts)

- [ ] **C2.** Remove `getPdfConversionUseIdempotencyUpsert()` from system-params.ts
  - Remove from SystemParams class
  - Remove standalone export

- [ ] **C3.** Remove import of `getPdfConversionUseIdempotencyUpsert` from pdf-to-exercises-task.ts

### Phase D: Remove "Richer Wins" Logic (SAFE)

- [ ] **D1.** Ensure merge policy is strictly "Last Wins"
  - No content comparison for "richer" data
  - Always overwrite on upsert

### Phase E: Delete Old Migrations (DB RESET REQUIRED)

- [ ] **E1.** Delete orphaned migration files:
  - `001-create-conversion-indexes.ts`
  - `003-add-exercise-unique-index.ts`
  - `005-drop-content-hash-unique-index.ts`

- [ ] **E2.** Rename remaining migrations sequentially:
  - `002-backfill-exercise-origin.ts` → `001-backfill-exercise-origin.ts`
  - `003-create-media-retention-index.ts` → `002-create-media-retention-index.ts`
  - `004-add-idempotency-key-index.ts` → `003-add-idempotency-key-index.ts`

- [ ] **E3.** Reset local database: `pnpm db:reset`

### Phase F: Update Tests

- [ ] **F1.** Update idempotency tests to use system ordinal
- [ ] **F2.** Add test: same PDF twice → 0 created, N updated
- [ ] **F3.** Update observability tests (log format changes)

---

## 2. Before/After: What Stays vs What Is Removed

### STAYS (Keep These)

| Item | File | Reason |
|------|------|--------|
| `contentHash` field | Exercises collection | Debug/change signal - NOT for dedup |
| `computeContentHash()` | hash.ts | Still computed for debugging |
| `normalizeExerciseInput()` | helpers.ts | Supports contentHash computation |
| contentHash in logs | pdf-to-exercises-task.ts | Useful for "same key, different content" detection |
| `idempotencyKey` field | Exercises collection | Primary dedup mechanism (FIXED) |
| `specVersion` field | Exercises collection | Version tracking |
| `extractionMeta` field | Exercises collection | Debug metadata |
| `origin` field | Exercises collection | Semantic marker for UI |
| `sourceDoc` | Exercises collection | PDF reference |
| `sourcePageStart/End` | Exercises collection | Page position |
| `sourceOrderInSegment` | Exercises collection | LLM ordering (metadata only) |
| `conversionJobId` | Exercises collection | Job tracking |
| Migration 002 → 001 | backfill-exercise-origin | Sets default origin |
| Migration 003 → 002 | create-media-retention-index | Media cleanup |
| Migration 004 → 003 | add-idempotency-key-index | **THE** dedup index |
| `computeIdempotencyKey()` | idempotency.ts | Core logic (FIXED to use system ordinal) |
| `deduplicateByIdempotencyKey()` | idempotency.ts | In-memory dedup |

### REMOVED (Delete These)

| Item | File | Reason |
|------|------|--------|
| `_useIdempotencyUpsert` variable | pdf-to-exercises-task.ts:119 | Declared but never used |
| `getPdfConversionUseIdempotencyUpsert()` | system-params.ts | Feature flag never checked |
| Import of above | pdf-to-exercises-task.ts:4 | Dead import |
| Migration 001-create-conversion-indexes | migrations/ | Creates orphaned contentHash indexes |
| Migration 003-add-exercise-unique-index | migrations/ | Creates orphaned contentHash index |
| Migration 005-drop-content-hash-unique-index | migrations/ | Targets wrong index names |
| `idx_exercise_dedup` | MongoDB | Orphaned unique index |
| `idx_exercise_unique_identity` | MongoDB | Orphaned unique index |
| Any "richer wins" comparison | pdf-to-exercises-task.ts | Merge is strictly "Last Wins" |

### CHANGED (Modified)

| Item | Change |
|------|--------|
| `computeIdempotencyKey()` | Use system ordinal (array index), not LLM `orderInSegment` |
| `createIdempotencyKeyFn()` | Accept system ordinal parameter |
| Upsert loop in task | Pass system ordinal (loop index) to key function |

---

## 3. Acceptance Checklist

### ✅ Idempotency Key Stability

```bash
# Test: Same PDF, same pages → same idempotencyKey
```

1. Run PDF conversion on test PDF (Run #1)
2. Record `idempotencyKey` for exercises on pages 1-3
3. Run PDF conversion again (Run #2)
4. Compare `idempotencyKey` values for same page range

**PASS:** All 10+ exercises have identical `idempotencyKey` between runs

### ✅ Deduplication Works

```bash
# Test: Re-run creates 0 new, updates N existing
```

1. Run PDF conversion (Run #1) → note `exercisesCreated` count
2. Run PDF conversion (Run #2) on same PDF
3. Check job output metrics

**PASS:**
- Run #2: `exercisesCreated = 0`
- Run #2: `exercisesDeduped > 0` (should equal Run #1 created count)
- Total exercise count in DB unchanged after Run #2

### ✅ contentHash Still Computed

```bash
# Test: contentHash available for debugging
```

1. Run PDF conversion
2. Query exercises: `db.exercises.find({ origin: 'conversion' }, { contentHash: 1 })`

**PASS:** All converted exercises have non-null `contentHash`

### ✅ contentHash NOT Used for Identity

```bash
# Test: Different content, same idempotencyKey → exercise updated (not duplicated)
```

1. Run conversion (creates exercise with contentHash A)
2. Manually modify PDF slightly (or mock different LLM output)
3. Run conversion again (would produce contentHash B)

**PASS:**
- Same `idempotencyKey` → exercise updated in place
- `contentHash` changed but no duplicate created
- Exercise count unchanged

### ✅ Dead Code Removed

```bash
# Test: No references to removed code
```

1. `grep -r "getPdfConversionUseIdempotencyUpsert" src/` → no results
2. `grep -r "_useIdempotencyUpsert" src/` → no results

**PASS:** No matches found

### ✅ Index State Correct

```bash
mongosh "mongodb://localhost:27017/payload"
db.exercises.getIndexes()
```

**PASS - Expected indexes:**
- `_id_` (default)
- `idx_exercise_idempotency_key_unique` (sparse, unique)

**PASS - Should NOT exist:**
- `idx_exercise_dedup`
- `idx_exercise_unique_identity`
- `idx_exercise_content_hash`

### ✅ Quality Gates Pass

```bash
pnpm typecheck && pnpm lint && pnpm test
```

**PASS:** All checks green

---

## Files to Modify

| Action | File |
|--------|------|
| **EDIT** | `src/server/services/exercise-conversion/idempotency.ts` (fix key computation) |
| **EDIT** | `src/server/payload/jobs/pdf-to-exercises-task.ts` (use system ordinal, remove dead code) |
| **EDIT** | `src/infra/config/system-params.ts` (remove feature flag) |
| **DELETE** | `src/server/payload/migrations/001-create-conversion-indexes.ts` |
| **DELETE** | `src/server/payload/migrations/003-add-exercise-unique-index.ts` |
| **DELETE** | `src/server/payload/migrations/005-drop-content-hash-unique-index.ts` |
| **RENAME** | `002-backfill-exercise-origin.ts` → `001-backfill-exercise-origin.ts` |
| **RENAME** | `003-create-media-retention-index.ts` → `002-create-media-retention-index.ts` |
| **RENAME** | `004-add-idempotency-key-index.ts` → `003-add-idempotency-key-index.ts` |
| **EDIT** | `tests/int/pdf-conversion-idempotency-upsert.int.spec.ts` |
| **EDIT** | `tests/unit/idempotency-key.test.ts` |
| **REGENERATE** | `src/payload-types.ts` (via `pnpm generate:types`) |

---

## Key Insight: Why Duplicates Happen

Current `idempotencyKey` format:
```
{tenant}:{lesson}:{doc}:{pageStart}-{pageEnd}:{orderInSegment}:{specVersion}
```

The `orderInSegment` comes from LLM extraction output. If LLM returns exercises in different order on re-run:
- Run 1: Exercise A gets `orderInSegment=1` → key ends with `:1:v1`
- Run 2: Exercise A gets `orderInSegment=2` → key ends with `:2:v1`
- Different keys → no match → new exercise created → DUPLICATE

**Fix:** Use array index from code (deterministic) instead of LLM field (non-deterministic).
