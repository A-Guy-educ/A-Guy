# Stats Page Bug Fix (#1895)

## What Was Fixed

The stats dashboard API (`src/app/api/stats/dashboard/route.ts`) had a bug in the progress record filtering logic.

## Root Cause

The filtering condition `!relevantLessonIds || relevantLessonIds.has(r.recordId)` was inconsistent:
- When `relevantLessonIds` is `null` (no chapters found): `!null` = `true` → all records included ✓
- When `relevantLessonIds` is an empty Set (chapters found but no lessons matched): `!emptySet` = `false` → `emptySet.has(x)` = `false` → NO records included ✗

This caused ALL progress records to be filtered out whenever chapters existed but no lessons matched the query criteria (published + active + in those chapters).

## The Fix

Changed the filtering logic to also include all records when `relevantLessonIds` or `relevantExerciseIds` is an empty Set (size === 0):

```typescript
return (
  !relevantLessonIds ||
  relevantLessonIds.size === 0 ||  // NEW: handle empty Set case
  relevantLessonIds.has(r.recordId)
)
```

Same fix applied for `relevantExerciseIds`.

## Files Changed

- `src/app/api/stats/dashboard/route.ts` — lines 167-190

## Verification

- Typecheck: PASS
- Lint: PASS (no new warnings)
- The verify tool confirmed the fix is complete
