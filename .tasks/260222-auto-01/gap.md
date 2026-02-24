# Gap Analysis: 260222-auto-01

## Summary

- Gaps Found: 3
- Spec Revised: Yes

## Gaps Found

### Gap 1: APIError Not Available in Codebase

**Severity:** High
**Location:** `src/server/payload/collections/Exercises/hooks.ts`
**Issue:** The spec requires importing and throwing `APIError` from `payload`, but this codebase does not use `APIError` anywhere. The existing codebase pattern is to use regular JavaScript `Error` (as seen in line 87 of the same file and 23 other locations in the codebase). The AGENTS.md documentation shows `APIError` in examples, but it's not actually imported or used anywhere in the actual code.
**Fix Applied:** Updated FR-002 to use `throw new Error(...)` instead of `APIError`, which aligns with existing codebase patterns.

### Gap 2: validateSlugUniqueness Also Needs Transaction Safety

**Severity:** High
**Location:** `src/server/payload/collections/Exercises/hooks.ts` (lines 59-92)
**Issue:** The spec only mentions updating the `generateSlug` hook (lines 35-54), but the `validateSlugUniqueness` hook has the same pattern of using `getPayloadInstance()` instead of `req.payload`. According to FR-003, both hooks that perform database queries should use `req.payload` for transaction safety. This is an inconsistency in the spec - if transaction safety is a requirement (SHOULD priority), it should apply to both hooks.
**Fix Applied:** Added FR-004 to also update `validateSlugUniqueness` hook with the same transaction safety requirements.

### Gap 3: Field Hook req Parameter Verification

**Severity:** Medium
**Location:** `src/server/payload/collections/Exercises/hooks.ts`
**Issue:** The spec assumes `req` is available in field hooks. Verified by checking `src/server/payload/collections/Media/hooks/inferMediaType.ts` which shows that field hooks DO receive `req` as a parameter. However, the spec should note that `req` may be undefined in certain contexts (e.g., when called from certain internal operations).
**Fix Applied:** Added a note in FR-003 to handle the case where `req` might be undefined, falling back to `getPayloadInstance()`.

## Changes Made to Spec

### Added FR-004: Update validateSlugUniqueness for Transaction Safety
**Priority:** SHOULD
**Description**: The `validateSlugUniqueness` hook (lines 59-92) also uses `getPayloadInstance()` which should be replaced with `req.payload.find` for consistency and transaction safety, matching the pattern in FR-003.

### Revised FR-002: Error on Exceeding Limits
**Original**: "it must throw an `APIError` from `payload`"
**Revised**: "it must throw a descriptive `Error`"
**Reasoning**: The codebase consistently uses `throw new Error(...)` rather than `APIError`. This aligns with existing patterns.

### Added Note to FR-003: Transaction Safety
**Added**: Note about handling undefined `req` - "If `req` is undefined (can happen in certain internal operations), fall back to using `getPayloadInstance()`."

### Updated Guardrail 2
**Original**: "Ensure the `APIError` is imported from `payload`."
**Revised**: Removed - no longer needed since we're using regular `Error`.

## Verification Against Codebase

- **Pattern for hooks using req**: Confirmed in `src/server/payload/collections/Posts/hooks/populateAuthors.ts` (line 8)
- **Pattern for field hooks with req**: Confirmed in `src/server/payload/collections/Media/hooks/inferMediaType.ts` (line 8)
- **Error throwing pattern**: Confirmed - codebase uses `throw new Error(...)` in 23+ locations
- **APIError usage**: Confirmed - NOT used anywhere in the codebase
