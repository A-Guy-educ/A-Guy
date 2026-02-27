# Plan Gap Analysis: 260226-auto-51

## Summary

- Gaps Found: 3
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Translation namespace structure mismatched spec

**Severity:** High  
**Issue:** The plan originally added `loading`/`error` under `common.*`, but the spec requires top-level `loading` and `error` objects in `src/i18n/en.json` and `src/i18n/he.json`. This would have caused implementation drift from the contract.  
**Fix Applied:** Updated Step 1 to add top-level keys and updated related tests/acceptance criteria to validate `loading.*` and `error.*` (not `common.loading.*` / `common.error.*`).

### Gap 2: Component translation namespaces depended on wrong key path

**Severity:** High  
**Issue:** Steps 2–4 referenced `useTranslations('common.loading')` / `useTranslations('common.error')`, which would not match the required key structure in the spec snippet.  
**Fix Applied:** Updated plan to use `useTranslations('loading')` and `useTranslations('error')` across root loading, root error, and nested lesson loading steps.

### Gap 3: Acceptance criteria for route-transition UX lacked explicit verification gate

**Severity:** Medium  
**Issue:** The original plan relied only on unit tests while acceptance criteria include navigation behavior (`course → lesson → exercise`) and blank-screen prevention, which are not fully proven by isolated component tests alone.  
**Fix Applied:** Added a manual smoke-check requirement in Step 5 for transition visibility and error recovery verification, alongside typecheck/lint/test gates.

## Changes Made to Plan

- Updated Assumptions to replace “no E2E needed” with explicit manual navigation smoke coverage.
- Updated Step 1 to:
  - use top-level `loading` and `error` translation keys,
  - update test assertions and acceptance criteria to match root namespace.
- Updated Step 2 namespace and acceptance criteria to `useTranslations('loading')`.
- Updated Step 3 namespace to `useTranslations('error')`.
- Updated Step 4 namespace to `useTranslations('loading')` and clarified translated text presence in loading UI/test expectations.
- Updated Step 5 to include:
  - targeted test execution wording,
  - manual navigation + error recovery smoke check,
  - explicit lint command in test commands block.
