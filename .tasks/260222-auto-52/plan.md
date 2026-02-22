# Plan: 260222-auto-52 — Remove Stale ESLint Directives in helpers.ts

## Status: Already Fixed — Verification-Only Plan

The bug described in the spec has **already been resolved** in commit `679ab40e` ("fix: replace all any types with proper TypeScript types"). The file `src/server/services/exercise-conversion/helpers.ts` currently:

- Contains **zero** `eslint-disable-next-line` comments
- Contains **zero** `any` type annotations
- Passes ESLint with `--max-warnings 0`
- Passes TypeScript type-checking (`tsc --noEmit`)

Since the code fix is already in place, this plan consists of a single verification step to confirm all acceptance criteria are met and add a regression test.

---

## Assumptions

1. The fix in commit `679ab40e` fully addresses FR-001, FR-002, and NFR-001.
2. No additional code changes are needed in `helpers.ts`.
3. A regression test should be added to prevent re-introduction of stale eslint-disable comments.

---

### Step 1: Add Regression Test for ESLint Cleanliness (10 min)

**Root Cause**: The original bug was misplaced `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments at lines ~68 and ~308 that didn't suppress any actual rule on the next line, generating ESLint warnings. These were already removed in commit `679ab40e`.

**Files to Touch**:
- `tests/unit/server/services/exercise-conversion/helpers.test.ts` (MODIFIED — add new describe block)
- `src/server/services/exercise-conversion/helpers.ts` (NO CHANGES — verification only)

**Reproduction Test** (MUST confirm the bug is already fixed):
- Test location: `tests/unit/server/services/exercise-conversion/helpers.test.ts`
- Test 1: `helpers.ts should not contain eslint-disable-next-line comments` — reads the source file content and asserts zero matches for `eslint-disable-next-line`
- Test 2: `helpers.ts should not contain any type annotations` — reads the source file content and asserts zero matches for `: any` or `as any`
- Why these pass now: The fix was already applied in commit `679ab40e`

**Exact behavior**:
- Read the contents of `src/server/services/exercise-conversion/helpers.ts` at test time using `fs.readFileSync`
- Assert that the file content does NOT match the regex `/eslint-disable-next-line/`
- Assert that the file content does NOT match the regex `/\bany\b/` (word-boundary match to catch `: any`, `as any`, `<any>`)

**Acceptance Criteria (spec traceability)**:
- [FR-001] ✅ No `eslint-disable-next-line @typescript-eslint/no-explicit-any` on lines ~68 or ~308
- [FR-002] ✅ No `any` types remain in the file
- [NFR-001] ✅ `npx eslint src/server/services/exercise-conversion/helpers.ts --max-warnings 0` exits 0

**Verification**:
- Run `pnpm vitest run tests/unit/server/services/exercise-conversion/helpers.test.ts` → ALL tests PASS
- Run `npx eslint src/server/services/exercise-conversion/helpers.ts --max-warnings 0` → exits 0
- Run `pnpm -s tsc --noEmit` → no errors in helpers.ts

---

## Test Commands

```bash
# Run unit tests for helpers
pnpm vitest run tests/unit/server/services/exercise-conversion/helpers.test.ts

# Verify ESLint cleanliness (MUST exit 0 with no warnings)
npx eslint src/server/services/exercise-conversion/helpers.ts --max-warnings 0

# Verify TypeScript compilation
pnpm -s tsc --noEmit
```

## Final Acceptance Checklist

| Criteria | Spec Ref | Status |
|----------|----------|--------|
| No `eslint-disable-next-line` directive at line ~69 | FR-001 | ✅ Already fixed |
| No `eslint-disable-next-line` directive at line ~309 | FR-001 | ✅ Already fixed |
| No `any` type on line ~70 | FR-002 | ✅ Already fixed |
| No `any` type on line ~323 | FR-002 | ✅ Already fixed |
| ESLint produces no unused-disable warnings | NFR-001 | ✅ Already fixed |
| Regression tests prevent re-introduction | — | Pending (Step 1) |
| Runtime behavior unchanged | Guardrails | ✅ No logic changes |
| No new TypeScript errors | Guardrails | ✅ Verified |
| Changes restricted to helpers.ts + test file | Guardrails | ✅ |
