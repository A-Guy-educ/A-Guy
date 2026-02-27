# Plan Gap Analysis: 260227-frontend-loading-error

## Summary

- Gaps Found: 4
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Unit test command used wrong Vitest config

**Severity:** Critical  
**Issue:** The plan’s verification command used `pnpm vitest run ...` without specifying `vitest.config.unit.mts`. In this repo, default `vitest.config.mts` only includes integration tests (`tests/int/**`), so new unit tests would not run.  
**Fix Applied:** Updated verification command to `pnpm vitest run --config ./vitest.config.unit.mts ...` and added an explicit assumption documenting this constraint.

### Gap 2: Optional lesson loading boundary treated as mandatory

**Severity:** Medium  
**Issue:** Spec marks nested lesson `loading.tsx` as optional, but the plan treated it as required in step language and acceptance criteria.  
**Fix Applied:** Updated Step 3 title/body/acceptance criteria and traceability to clearly mark lesson-level loading as optional enhancement.

### Gap 3: Non-spec console logging requirement added unnecessary risk

**Severity:** Medium  
**Issue:** Plan added `console.error(error)` + dedicated test, which is not required by spec and can introduce lint/noise risk.  
**Fix Applied:** Removed console logging requirement and replaced test with a deterministic contract check (`data-error-digest` when digest exists) while still using `{ error, reset }` props.

### Gap 4: Design-token usage for spinner color not explicit

**Severity:** High  
**Issue:** Acceptance criteria requires loading UI to use design tokens; original spinner usage didn’t explicitly apply a tokenized color class.  
**Fix Applied:** Updated loading implementations/tests to pass `className="text-primary"` to `Spinner` and strengthened acceptance/traceability language.

## Changes Made to Plan

- Updated **Assumptions** to include unit-test config constraint (`vitest.config.unit.mts`).
- Updated **Step 2** implementation/tests/acceptance to enforce explicit design-token class (`text-primary`) on spinner.
- Updated **Step 3** to:
  - keep `error.tsx` aligned with Next segment boundary contract,
  - remove console logging requirement,
  - mark lesson loading file/tests as optional per spec.
- Updated **Verification Commands** to run unit tests with `--config ./vitest.config.unit.mts`.
- Updated **Files Summary** and **Spec Requirement Traceability** to reflect optional lesson loading and improved design-token verification.
