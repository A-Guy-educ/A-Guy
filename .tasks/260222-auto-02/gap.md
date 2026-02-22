# Gap Analysis: 260222-auto-02

## Summary

- Gaps Found: 3
- Spec Revised: Yes

## Gaps Found

### Gap 1: SelectedCourseCard - fetchCourse Called From Multiple Places

**Severity:** Critical
**Location:** `src/app/(frontend)/account/_components/SelectedCourseCard.tsx`
**Issue:** The spec assumed the fetch only happens in the useEffect hook, but the `fetchCourse` function is also called from the `handleRetry` function (line 85). Simply adding AbortController to useEffect won't handle the case when handleRetry is called. Additionally, when handleRetry is invoked while the component is still mounted from a previous fetch, there could be a race condition.
**Fix Applied:** Updated FR-002 to require refactoring `fetchCourse` to accept an optional `AbortSignal` parameter. Added acceptance criteria requiring handleRetry to create its own AbortController for manual retry functionality. Added guardrail to ensure handleRetry continues to work after changes.

### Gap 2: AbortError Handling Not Explicitly Detailed

**Severity:** High
**Location:** All three components (GreetingFlow, SelectedCourseCard, HealthBadge)
**Issue:** The NFR-001 stated that AbortError should be "silently ignored" but didn't specify implementation details:
- GreetingFlow currently logs ALL errors with `console.error` (line 39)
- SelectedCourseCard has an empty catch block but doesn't differentiate AbortError
- HealthBadge sets error state for ALL catches

**Fix Applied:** Added detailed implementation guidance to NFR-001:
- GreetingFlow: Check `error.name === 'AbortError'` before logging
- SelectedCourseCard: Check `error.name === 'AbortError'` and silently ignore
- HealthBadge: Check `error.name === 'AbortError'` before setting error state

### Gap 3: Missing Acceptance Criteria for SelectedCourseCard handleRetry

**Severity:** High
**Location:** Acceptance Criteria section
**Issue:** The original spec didn't account for the fact that SelectedCourseCard has two different call sites for its fetch function (useEffect and handleRetry). The implementation needs to handle both cases properly.
**Fix Applied:** Added two new acceptance criteria:
- "In SelectedCourseCard, the fetchCourse function accepts an optional AbortSignal parameter"
- "In SelectedCourseCard, the handleRetry function creates its own AbortController for manual retry functionality"

## Changes Made to Spec

- **Updated FR-002:** Added detailed description about refactoring `fetchCourse` to accept optional AbortSignal parameter, and handleRetry creating its own AbortController
- **Updated NFR-001:** Added "Implementation Details" section with component-specific guidance for handling AbortError
- **Updated Acceptance Criteria:** Added 2 new criteria for SelectedCourseCard handleRetry handling
- **Updated Guardrails:** Added new guardrail ensuring handleRetry continues to work after adding AbortController
