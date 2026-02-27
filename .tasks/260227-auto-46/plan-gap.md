# Plan Gap Analysis: 260227-auto-46

## Summary

- Gaps Found: 3
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Brittle i18n edit instructions tied to line numbers

**Severity:** Medium  
**Issue:** Step 1 instructed inserting keys at exact line numbers in `en.json`/`he.json`. This is fragile and can break if locale files shift before implementation.  
**Fix Applied:** Updated Step 1 file instructions to target semantic placement inside `common` (near `notFound`) instead of hardcoded line offsets.

### Gap 2: i18n test approach inconsistent with repo patterns

**Severity:** Medium  
**Issue:** Step 1 tests proposed `fs.readFileSync + JSON.parse` even though this codebase commonly imports locale JSON directly in unit tests.  
**Fix Applied:** Revised Step 1 test design to use direct JSON imports for `src/i18n/en.json` and `src/i18n/he.json`, reducing path/ESM brittleness.

### Gap 3: Missing explicit runtime validation for App Router boundary behavior

**Severity:** High  
**Issue:** Unit tests validated component rendering, but acceptance criteria also require true runtime behavior (loading before content readiness, graceful error fallback in route execution) that isolated component tests cannot fully prove.  
**Fix Applied:** Added Step 4 for explicit manual runtime verification under `pnpm dev`, including navigation loading checks, lesson-route loading checks, error fallback rendering, and retry behavior via `reset()`.

## Changes Made to Plan

- Updated header: estimated steps changed from 3 to 4.
- Updated Step 1 “Files to Touch” notes to remove line-number dependency.
- Updated Step 1 test strategy from filesystem parsing to direct JSON imports.
- Added Step 4: runtime App Router validation for loading and error boundaries.
- Expanded quality gates with mandatory manual runtime verification.
- Updated test dependency notes to reflect actual expected tooling (`fs` only for `'use client'` assertions; JSON imports for i18n keys).
- Updated requirement traceability table so FR-1/FR-2/FR-3 include runtime verification coverage.
