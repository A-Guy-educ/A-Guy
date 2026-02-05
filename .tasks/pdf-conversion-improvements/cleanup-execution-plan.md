# PDF Conversion Cleanup Execution Plan

## Requirements Validation

### 1) Remove legacy "richer wins" entirely ✅ VALIDATED

**Finding:** `isContentRicher()` exists at [helpers.ts:350-398](src/server/services/exercise-conversion/helpers.ts#L350-L398) but is **NOT called anywhere** in production code.

- Function defined but has **ZERO call sites** in src/
- Already dead code - the "Last Wins" semantics are implemented in [pdf-to-exercises-task.ts:191-214](src/server/payload/jobs/pdf-to-exercises-task.ts#L191-L214)
- **Action:** Delete the function (safe removal)

### 2) Ensure we are NOT enforcing contentHash uniqueness ✅ VALIDATED

**Finding:** No contentHash unique index exists in production code.

- **No migrations folder** exists at `src/server/payload/migrations/`
- **No unique index** on `(lesson, sourceDoc, contentHash)` in Exercises collection
- `contentHash` field exists at [Exercises/index.ts:181-184](src/server/payload/collections/Exercises/index.ts#L181-L184) but with NO index
- `idempotencyKey` has a **non-unique** index at line 189
- References to `idx_exercise_unique_identity` exist only in planning docs, not in code
- **Action:** None needed (already clean)

### 3) Normalize access strategy: req vs overrideAccess ⚠️ NEEDS REVIEW

**Finding:** Currently uses **BOTH** `overrideAccess: true` AND `req` together in all Payload operations.

Current pattern in [pdf-to-exercises-task.ts](src/server/payload/jobs/pdf-to-exercises-task.ts):
```typescript
// Line 177-186: Find
await payload.find({
  collection: 'exercises',
  where: { idempotencyKey: { equals: idempotencyKey } },
  overrideAccess: true,  // ✅ Bypasses access control
  req,                   // ⚠️ Also passing req
})

// Line 193-214: Update
await payload.update({
  collection: 'exercises',
  id: existingDoc.id,
  data: { ... },
  overrideAccess: true,  // ✅ Bypasses access control
  req,                   // ⚠️ Also passing req
})

// Line 219-244: Create
await payload.create({
  collection: 'exercises',
  data: { ... },
  overrideAccess: true,  // ✅ Bypasses access control
  req,                   // ⚠️ Also passing req
})
```

**Analysis:** The current pattern is **actually correct** for Payload jobs:
- `overrideAccess: true` - Bypasses access control for internal operations
- `req` - Provides request context for hooks, transactions, and audit logging

**Recommendation:** Keep current approach. This is the idiomatic pattern for Payload background jobs.

### 4) Confirm content model compatibility ✅ VALIDATED

**Finding:** The content model is correctly handled.

In [helpers.ts:306-344](src/server/services/exercise-conversion/helpers.ts#L306-L344), `toPayloadContent()`:
- `b.type === 'latex'` → `{ type: 'latex', latex: b.latex, renderMode: ... }`
- `b.type === 'rich_text'` → `{ type: 'rich_text', value: b.value, format: ... }`

In `isContentRicher()` (dead code at lines 350-398), it references:
- `b.type === 'latex'` with `b.latex`
- `b.type === 'rich_text'` with `b.value`

**Both use same field names** - no compatibility issue. But `isContentRicher` is dead code anyway.

### 5) Verify idempotencyKey is the ONLY identity used ✅ VALIDATED

**Finding:** idempotencyKey IS the sole identity mechanism.

From [pdf-to-exercises-task.ts:177-186](src/server/payload/jobs/pdf-to-exercises-task.ts#L177-L186):
```typescript
const existing = await payload.find({
  collection: 'exercises',
  where: {
    idempotencyKey: { equals: idempotencyKey },  // ✅ Sole lookup key
  },
  ...
})
```

From [Exercises/index.ts:187-193](src/server/payload/collections/Exercises/index.ts#L187-L193):
```typescript
{
  name: 'idempotencyKey',
  type: 'text',
  index: true,  // ✅ Indexed (non-unique for now)
}
```

Counters are already implemented at [pdf-to-exercises-task.ts:52-54](src/server/payload/jobs/pdf-to-exercises-task.ts#L52-L54):
```typescript
exercisesCreated: 0,
exercisesDeduped: 0,
exercisesSkipped: 0,
```

---

## Implementation Plan

### Files to Change

| File | Action | Why |
|------|--------|-----|
| `src/server/services/exercise-conversion/helpers.ts` | DELETE function `isContentRicher` (lines 346-398) | Dead code, never called |
| `tests/int/pdf-conversion-cleanup-regression.int.spec.ts` | UPDATE tests to remove stale keyFn signature | Tests use old signature `(ex) =>` instead of `(ex, idx) =>` |

### Files Already Clean (No Changes Needed)

| File | Status |
|------|--------|
| `src/server/payload/jobs/pdf-to-exercises-task.ts` | ✅ Uses idempotencyKey exclusively, Last Wins implemented |
| `src/server/payload/collections/Exercises/index.ts` | ✅ No contentHash unique index |
| `src/server/services/exercise-conversion/idempotency.ts` | ✅ Uses systemOrdinal, not LLM orderInSegment |
| `src/server/payload/migrations/` | ✅ Directory doesn't exist - no orphan migrations |

---

## Execution Steps

### Step 1: Delete `isContentRicher` function

Delete lines 346-398 from [helpers.ts](src/server/services/exercise-conversion/helpers.ts):
- Line 346: Empty line before function
- Lines 347-349: JSDoc comment
- Lines 350-398: Function definition

### Step 2: Fix test keyFn signatures

In [pdf-conversion-cleanup-regression.int.spec.ts](tests/int/pdf-conversion-cleanup-regression.int.spec.ts), tests use:
```typescript
const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`
```

But `deduplicateByIdempotencyKey` expects:
```typescript
keyFn: (ex: EnrichedExercise, systemIndex: number) => string
```

Fix: Update all keyFn definitions to match expected signature.

### Step 3: Run quality gates

```bash
pnpm typecheck
pnpm lint
pnpm test:int tests/int/pdf-conversion-cleanup-regression.int.spec.ts
pnpm test:unit tests/unit/idempotency-key.test.ts
```

---

## Verification Evidence (To Collect After Implementation)

### Grep Results Proving No contentHash-Unique Identity

```bash
# Search for unique index creation on contentHash
grep -r "unique.*contentHash\|contentHash.*unique" src/
# Expected: 0 matches

# Search for contentHash in identity lookups
grep -r "where.*contentHash\|findOne.*contentHash" src/server/
# Expected: 0 matches

# Search for isContentRicher calls
grep -r "isContentRicher" src/
# Expected: 0 matches after deletion
```

### Acceptance Test (Manual)

After implementation:
1. Run same PDF through conversion twice
2. Check job output:
   - Run #1: `exercisesCreated: N, exercisesDeduped: 0`
   - Run #2: `exercisesCreated: 0, exercisesDeduped: N`
3. Total exercise count should remain stable

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Deleting `isContentRicher` breaks something | Already dead code with 0 call sites - grep verified |
| Tests fail after keyFn fix | Fix aligns tests with actual API signature |
| contentHash index exists in production MongoDB | Need to verify Atlas has no orphan indexes (manual check) |

---

## Summary

**Scope:** Minimal cleanup - only 2 files need changes:
1. Delete 52 lines of dead code (`isContentRicher`)
2. Fix ~6 test keyFn signatures

**All requirements validated:**
- ✅ #1: `isContentRicher` is dead code, safe to delete
- ✅ #2: No contentHash unique index in codebase
- ✅ #3: Access strategy is correct (overrideAccess + req is idiomatic)
- ✅ #4: Content model fields are consistent
- ✅ #5: idempotencyKey is the sole identity, counters exist
