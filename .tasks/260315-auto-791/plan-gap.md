# Plan Gap Analysis: 260315-auto-791

## Summary

- Gaps Found: 5
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Incorrect vitest test commands (`--grep` not supported)

**Severity:** Critical (Feasibility)
**Issue:** The plan used `pnpm test:int -- --grep "access-codes"` in Steps 2–5, 9–11. Vitest does not support `--grep`. The correct approach is to pass the file path directly: `pnpm test:int tests/int/access-codes.int.spec.ts`.
**Fix Applied:** Replaced all 7 instances of `-- --grep "access-codes"` with the direct file path. Also replaced `pnpm vitest run` with `pnpm test:unit` for unit tests, matching the project's npm scripts.

### Gap 2: Missing server-side blocking for `accessCode` in lesson page

**Severity:** High
**Issue:** The lesson page (`page.tsx`, line 69) has a server-side block that prevents SSR content rendering for `mandatory` access type when user is unauthenticated. The plan's Step 8 only mentioned passing `lessonId` to `AccessGateProvider` but did NOT address adding a similar server-side block for `accessCode`. Without this, unauthenticated users could see server-rendered content before the client-side gate kicks in.
**Fix Applied:** Updated Step 8 "Files also touching" to explicitly include adding a server-side block for `accessCode` type in the lesson page, identical to the existing `mandatory` pattern.

### Gap 3: FR-003 (User Redeemed Codes Field) not implemented — undocumented deviation

**Severity:** Medium
**Issue:** Spec FR-003 (MUST priority) requires adding a `redeemedAccessCodes` array field to the Users collection. The plan replaces this with the `code-redemptions` collection (FR-004) + the check endpoint (Step 9), which is architecturally superior. However, this deviation from the spec was not documented.
**Fix Applied:** Added explicit documentation of this deviation in two places: (1) after Step 4 as a note explaining the rationale, and (2) in the Rerun Context section under "Spec Deviations."

### Gap 4: Spec scope deviation not documented (lesson-only vs course/global)

**Severity:** Medium
**Issue:** Spec FR-002 says `scopeType` MUST support `lesson`, `course`, and `global`. The plan narrows this to `lesson` only per clarified answer #2. While this is justified by stakeholder input, the deviation from the spec was not clearly documented as a deliberate choice.
**Fix Applied:** Added a "Spec Deviations" section in the Rerun Context documenting that FR-002 scope is narrowed to lesson-only per clarification, with extensibility noted.

### Gap 5: Unit test file paths don't follow project conventions

**Severity:** Low
**Issue:** The plan placed component tests at `tests/unit/AccessCodeGateModal.test.tsx` (root of unit dir). Project convention puts component tests under `tests/unit/components/` (e.g., `tests/unit/components/CourseCard.test.tsx`, `tests/unit/components/McqQuestion.test.tsx`).
**Fix Applied:** Moved test file paths to `tests/unit/components/AccessCodeGateModal.test.tsx` and `tests/unit/components/AccessGateProvider-accessCode.test.tsx`.

## Reuse Corrections

No reuse issues found. The plan correctly:
- Reuses `adminOnly` from `src/server/payload/access/adminOnly.ts`
- Reuses `authenticated` from `src/server/payload/access/authenticated.ts`
- Reuses `authenticatedOrOwner` pattern from `src/server/payload/access/authenticatedOrOwner.ts`
- Reuses `createdByField` from `src/server/payload/fields/createdBy.ts`
- Reuses `tenantField` from `src/server/payload/fields/tenant.ts`
- Reuses `Dialog` components from `src/ui/web/components/dialog`
- Extends (not replaces) `resolveAccessType` from `src/infra/auth/access-types.ts`

## Feasibility Assessment

- **All referenced existing files verified** — All MODIFIED file paths exist and contain the expected content at the referenced line numbers.
- **All proposed NEW file paths valid** — Parent directories exist for all new files.
- **Import availability confirmed** — `adminOnly`, `authenticated`, `authenticatedOrOwner`, `createdByField`, `tenantField` all export the expected functions.
- **Step ordering correct** — Dependencies are properly sequenced (types → collections → API → frontend).
- **Test runner commands corrected** — Fixed from `--grep` to direct file paths.
- **Step sizes reasonable** — All steps touch 1-3 files, appropriate for 10-30 min work each.

## Changes Made to Plan

1. **Fixed test commands** (Steps 2, 3, 4, 5, 9, 10, 11): Replaced `pnpm test:int -- --grep "access-codes"` with `pnpm test:int tests/int/access-codes.int.spec.ts`
2. **Fixed unit test commands** (Steps 1, 6, 7, 8): Replaced `pnpm vitest run` with `pnpm test:unit`
3. **Added server-side block** (Step 8): Added explicit instruction to handle `accessCode` server-side blocking in lesson page.tsx
4. **Documented FR-003 deviation** (Step 4): Added note explaining why code-redemptions collection replaces the User array field
5. **Documented scope deviation** (Rerun Context): Added "Spec Deviations" section for lesson-only scope and FR-003 replacement
6. **Fixed test file paths** (Steps 7, 8): Moved to `tests/unit/components/` directory per project convention
7. **Added missing new files** to research findings: Listed all new test files and the check endpoint
