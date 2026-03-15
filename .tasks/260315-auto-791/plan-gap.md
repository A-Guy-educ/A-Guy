# Plan Gap Analysis: 260315-auto-791

## Summary

- Gaps Found: 5
- Plan Revised: Yes

## Gaps Identified

### Gap 1: `accessCode` added to `pageAccessType` contradicts "lesson only" clarification

**Severity:** High
**Issue:** Step 2 originally added `accessCode` to both `pageAccessType` (course page access) and `accessType` (lesson default) on the Courses collection. However, clarification #2 explicitly says "lesson only" — access codes should gate lesson content, not course listing pages. Adding `accessCode` to `pageAccessType` would gate the course's chapter/lesson listing page, which doesn't make sense (students need to see available lessons to know what code to enter).
**Fix Applied:** Removed `accessCode` from `pageAccessType` options in Courses. Only `accessType` (the default for lessons) gets the new option. Added explicit rationale in the step.

### Gap 2: Unit tests for React components not feasible with current test setup

**Severity:** High
**Issue:** Steps 8 and 9 originally specified unit tests at `tests/unit/access-code-gate-modal.unit.spec.ts` and `tests/unit/access-gate-provider.unit.spec.ts` (TSX component tests). However, the project's `vitest.config.unit.mts` uses `environment: 'node'` (not jsdom), and there are zero `.tsx` unit tests in the entire project. React component rendering tests would fail without jsdom environment.
**Fix Applied:** Replaced TSX unit tests with integration-level test references in `tests/int/access-code-gate.int.spec.ts`. Added notes that client-side component behavior should be verified via E2E tests or through the underlying API endpoints (Steps 5-6) which the hooks depend on. Removed references to non-viable test files from Step 11.

### Gap 3: Type generation ordering — must happen before UI steps

**Severity:** Medium
**Issue:** Step 11 (type generation) was placed last, but Steps 8-9 import generated types from the new `AccessCode` and `CodeRedemption` collections. Without running `pnpm generate:types` first, Steps 8-9 would fail to compile.
**Fix Applied:** Added a note to Step 11 stating type generation MUST also be run after Steps 3-4, before Steps 8-9. The build agent should run `pnpm generate:types` as part of Steps 3 or 4 to enable downstream imports.

### Gap 4: `useAccessGate` hook changes underspecified

**Severity:** Medium
**Issue:** Step 9 listed hook changes but was vague about the new `lessonId` parameter, the loading state during access check, and how `AccessGateProvider` wires the hook output to the new modal. The hook's `UseAccessGateParams` interface needs `lessonId`, the provider needs to pass it through, and the `isBlocked` computation needs updating.
**Fix Applied:** Expanded Step 9 with: (a) `lessonId?: string` added to `UseAccessGateParams`, (b) `isCheckingAccess` loading state, (c) `onCodeRedeemed()` callback behavior, (d) updated `isBlocked` computation in provider, (e) explicit `AccessCodeGateModal` import note.

### Gap 5: FR-003 (User Redeemed Codes Field) intentionally omitted — acceptable

**Severity:** Low
**Issue:** The spec FR-003 calls for adding a `redeemedAccessCodes` array field to the Users collection. The plan instead uses the separate `CodeRedemptions` collection + check-access API endpoint. This is a deliberate design improvement: it avoids bloating the Users collection, makes the "no retained access on deletion" clarification trivial (runtime check against active codes), and keeps the Users auth collection lean.
**Fix Applied:** No plan change needed — the plan's approach is superior to the spec's suggestion. The spec's FR-003 is satisfied by the `code-redemptions` collection (FR-004) + check-access endpoint (Step 6).

## Reuse Corrections

No reuse corrections needed. The plan correctly reuses:
- `adminOnly` from `src/server/payload/access/adminOnly.ts`
- `authenticated` from `src/server/payload/access/authenticated.ts`
- `createdByField` from `src/server/payload/fields/createdBy.ts`
- `tenantField` from `src/server/payload/fields/tenant.ts`
- `Dialog` components from `src/ui/web/components/dialog`
- `useCurrentUser` from `src/client/hooks/useCurrentUser.ts`
- `useTranslations` from `src/ui/web/providers/I18n`

## Feasibility Issues

### File paths verified ✅
All referenced source files exist:
- `src/infra/auth/access-types.ts` ✅
- `src/server/payload/collections/Courses.ts` ✅ (accessType options at line ~167)
- `src/server/payload/collections/Lessons.ts` ✅ (accessType options at line ~157)
- `src/payload.config.ts` ✅ (collections array at line ~143)
- `src/ui/web/auth/AccessGateProvider.tsx` ✅
- `src/client/hooks/useAccessGate.ts` ✅
- `src/ui/web/auth/AuthGateModal.tsx` ✅ (pattern reference)
- `src/server/payload/access/adminOnly.ts` ✅
- `src/server/payload/access/authenticated.ts` ✅
- `src/server/payload/fields/createdBy.ts` ✅
- `src/server/payload/fields/tenant.ts` ✅
- `src/i18n/en.json` ✅ (accessControl namespace at line ~314)
- `src/i18n/he.json` ✅ (accessControl namespace at line ~314)

### Import paths verified ✅
All proposed imports exist in their respective modules.

### Test commands verified ✅
- `pnpm vitest run tests/unit/...` uses `vitest.config.unit.mts` (includes `tests/unit/**/*.spec.ts`)
- `pnpm vitest run tests/int/...` uses `vitest.config.mts` (includes `tests/int/**/*.int.spec.ts`)
- Test runner is vitest (not jest), package manager is pnpm (not npm) — correct

### Step ordering verified ✅
- Steps 1-2: Access types + collection field changes (no cross-dependencies)
- Steps 3-4: New collections (independent of each other)
- Steps 5-6: API endpoints (depend on Steps 3-4 collections existing)
- Step 7: i18n strings (independent)
- Steps 8-9: UI components (depend on Steps 5-6 APIs + Step 7 translations + generated types from Steps 3-4)
- Step 10: CSV export (depends on Step 4 collection)
- Step 11: Final quality gates

## Changes Made to Plan

- Updated Step 2: Removed `accessCode` from `pageAccessType` options (lesson-only scope per clarification)
- Updated Step 8: Replaced TSX unit tests with integration test references (jsdom not available in unit config)
- Updated Step 9: Expanded hook param details (`lessonId`, `isCheckingAccess`, `onCodeRedeemed`), expanded provider wiring details
- Updated Step 9 tests: Replaced TSX unit tests with integration test notes
- Updated Step 11: Added type generation ordering note, removed non-viable test file references
