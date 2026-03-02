# Implementation Plan: Study Plan Manual Generate/Regenerate

## Rerun Context

Previous plan was a high-level outline lacking test-gates, file line references, and step-by-step detail. This rerun produces a fully detailed TDD plan with exact files, line ranges, behavior specs, and failing-then-passing tests for each step. No approach change — the core design (remove auto-regeneration, add dirty state, explicit Generate/Regenerate only) remains the same.

---

## Assumptions

- No clarified.md was provided; working directly from spec.md
- The `test plan.html` referenced in spec is not present — we follow existing design patterns (Tailwind, RTL, Lucide icons) already established in the codebase
- `default-course` hardcoded courseId is acceptable for this scope
- No engine algorithm changes needed per spec scope
- The `EmptyPlanState` component already exists and shows the correct Hebrew title text (`מוכנים לצאת לדרך?`)
- The i18n keys `studyPlan.generateButton` and `studyPlan.empty.title` already exist
- A new i18n key `studyPlan.regenerateButton` is needed for the Regenerate button text

---

## Step 1: Add `regenerateButton` i18n keys (5 min)

### Files to Touch
- `src/i18n/en.json` (MODIFIED — line ~510, add key after `generateButton`)
- `src/i18n/he.json` (MODIFIED — line ~510, add key after `generateButton`)

### Exact Behavior
Add a new translation key `studyPlan.regenerateButton`:
- **en.json**: `"regenerateButton": "Regenerate Plan"`
- **he.json**: `"regenerateButton": "עדכן תוכנית"`

### Tests (1 test — FAIL before, PASS after)
**File**: `tests/unit/components/StudyPlanPage.test.tsx` (NEW)
- **Test**: `should have regenerateButton key in en.json and he.json`
  - Import en.json and he.json
  - Assert `enMessages.studyPlan.regenerateButton` is a non-empty string
  - Assert `heMessages.studyPlan.regenerateButton` is a non-empty string
  - **Fails before**: Key doesn't exist yet → `undefined`
  - **Passes after**: Key exists with string value

### Acceptance Criteria
- [ ] `en.json` contains `studyPlan.regenerateButton` with English text
- [ ] `he.json` contains `studyPlan.regenerateButton` with Hebrew text
- [ ] No other keys modified

---

## Step 2: Remove auto-regeneration useEffect and add dirty state to StudyPlanPage (15 min)

### Files to Touch
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (MODIFIED — lines 64, 81, 94, 99, 116-127, 166)

### Exact Behavior

1. **Remove `pendingRegeneration` ref** (line 64): Delete the `useRef(false)` — no longer needed
2. **Add `isDirty` state**: `const [isDirty, setIsDirty] = useState(false)`
3. **Remove all `pendingRegeneration.current = true` assignments** (lines 81, 94, 99, 166): Replace with `if (hasGenerated) setIsDirty(true)` — only mark dirty AFTER initial generation
4. **Delete the auto-regeneration `useEffect`** (lines 116-127 entirely): This is the core change — remove the debounced auto-regeneration
5. **Update `handleGeneratePlan`** (lines 110-114): After successful generation, also `setIsDirty(false)` to clear dirty flag

After this step:
- Changing date/topics/mastery after generation does NOT recompute or re-render the plan
- `isDirty` becomes `true` when inputs change after initial generation
- `isDirty` resets to `false` after Generate/Regenerate click

### Tests (2 tests — FAIL before, PASS after)
**File**: `tests/unit/components/StudyPlanPage.test.tsx` (NEW — same file as Step 1)

**Test 1**: `should NOT auto-regenerate when topics change after initial generation`
- Setup: Render `<StudyPlanPage />` with I18n provider, mock `fetch` to return a plan on first call
- Act: Click Generate button, wait for plan to appear, then add a new topic
- Assert: `fetch` was NOT called again with `action: 'generate'` after the topic was added
- **Fails before**: The `useEffect` auto-triggers regeneration after 500ms debounce
- **Passes after**: No auto-regeneration effect exists

**Test 2**: `should NOT auto-regenerate when exam date changes after initial generation`
- Setup: Same as above
- Act: Click Generate, wait for plan, change exam date input
- Assert: `fetch` was NOT called again with `action: 'generate'`
- **Fails before**: `pendingRegeneration` + `useEffect` triggers auto-regen
- **Passes after**: No auto-regeneration

### Acceptance Criteria
- [ ] No `useEffect` that calls `generatePlan` based on input changes
- [ ] `pendingRegeneration` ref is removed
- [ ] `isDirty` state is `false` initially and after generation
- [ ] `isDirty` becomes `true` when inputs change after `hasGenerated` is true
- [ ] Spec FR-2 satisfied: No auto-regeneration on input edits

---

## Step 3: Show Regenerate button when dirty, hide Generate button after first generation (15 min)

### Files to Touch
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (MODIFIED — lines ~206-217 sidebar section, add Regenerate button)

### Exact Behavior

1. **Existing Generate button** (lines 207-217): Already conditionally rendered with `{!hasGenerated && (...)}` — keep as-is
2. **Add Regenerate button**: After the existing Generate button block, add:
   ```
   {hasGenerated && isDirty && (
     <Button onClick={handleGeneratePlan} disabled={!examDate || topics.length === 0 || isLoading} size="lg" className="w-full">
       <Zap className="w-5 h-5 me-2" />
       {t('regenerateButton')}
     </Button>
   )}
   ```
3. The Regenerate button calls the same `handleGeneratePlan` which:
   - Calls `generatePlan(examDate, topics, 'default-course')`
   - Sets `hasGenerated = true`
   - Sets `isDirty = false` (from Step 2)
4. After regeneration, the Regenerate button disappears (isDirty = false)

### Tests (3 tests — FAIL before, PASS after)
**File**: `tests/unit/components/StudyPlanPage.test.tsx` (same file, continued)

**Test 1**: `should show Generate button before first generation, not Regenerate`
- Render component with no existing plan (fetch returns empty)
- Assert: Button with text matching `t('generateButton')` ("Build Focus Plan") is visible
- Assert: No button with text matching `t('regenerateButton')` ("Regenerate Plan") exists
- **Fails before**: Test infrastructure not set up yet (new test file)
- **Passes after**: Generate button shows, Regenerate does not

**Test 2**: `should show Regenerate button when inputs change after generation`
- Render, generate plan (click Generate, mock successful API), then change a topic mastery level
- Assert: Button with text "Regenerate Plan" is visible
- Assert: Button with text "Build Focus Plan" is NOT visible (hasGenerated = true)
- **Fails before**: No Regenerate button exists in the UI
- **Passes after**: Regenerate button appears when isDirty && hasGenerated

**Test 3**: `should hide Regenerate button after clicking it`
- Render, generate plan, change input (isDirty = true), click Regenerate
- Assert: After API response, Regenerate button disappears (isDirty reset to false)
- **Fails before**: No Regenerate button exists
- **Passes after**: Regenerate appears when dirty, disappears after click

### Acceptance Criteria
- [ ] Generate button visible only before first generation (`!hasGenerated`)
- [ ] Regenerate button visible only when `hasGenerated && isDirty`
- [ ] Regenerate calls same `handleGeneratePlan` function
- [ ] After Regenerate click, dirty state resets → button hides
- [ ] Spec FR-3 satisfied: Dirty state tracking with explicit Regenerate
- [ ] Spec FR-4 satisfied: Generate/Regenerate is the only path to compute + persist

---

## Step 4: Verify empty state renders before Generate click (10 min)

### Files to Touch
- `src/app/(frontend)/study-plan/_components/EmptyPlanState.tsx` (VERIFIED — no changes needed, already has correct title)
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (VERIFIED — already renders `<EmptyPlanState />` when `!plan`)

### Exact Behavior

The current code at lines 246-248 already renders `<EmptyPlanState />` when `plan` is null.
The `EmptyPlanState` already displays `t('empty.title')` which is `"מוכנים לצאת לדרך?"` in Hebrew.

No code changes needed — just add the test to verify this contract.

### Tests (2 tests — FAIL before, PASS after)
**File**: `tests/unit/components/StudyPlanPage.test.tsx` (same file, continued)

**Test 1**: `should show empty state with Hebrew CTA text before Generate click`
- Render `<StudyPlanPage />` with Hebrew locale, mock fetch returning no existing plan
- Assert: Text "מוכנים לצאת לדרך?" is visible
- Assert: No day cards are rendered (no elements with day date text)
- **Fails before**: Test file doesn't exist yet
- **Passes after**: Empty state renders correctly

**Test 2**: `should show empty state in English before Generate click`
- Render with English locale, mock fetch returning no existing plan
- Assert: Text "Ready to start?" is visible
- **Fails before**: Test file doesn't exist yet
- **Passes after**: English empty state renders

### Acceptance Criteria
- [ ] Empty state visible before any Generate click
- [ ] No plan/day-cards rendered before Generate click
- [ ] Spec FR-1 satisfied: Empty state before generation with correct Hebrew text

---

## Step 5: Integration — full user flow test (10 min)

### Files to Touch
- No production code changes — test-only step

### Exact Behavior
End-to-end unit test simulating the complete user journey:
1. Page loads → empty state shown
2. User enters exam date + adds topics → still empty state (no auto-generate)
3. User clicks Generate → plan appears, Generate button hides
4. User changes a topic mastery → plan stays the same, Regenerate button appears
5. User clicks Regenerate → new plan generated, Regenerate button hides

### Tests (1 integration test — FAIL before, PASS after)
**File**: `tests/unit/components/StudyPlanPage.test.tsx` (same file, continued)

**Test**: `full user flow: empty → generate → dirty → regenerate`
- Mock `fetch`:
  - GET: returns `{ success: true, data: null }` (no existing plan)
  - PUT with action=generate (1st call): returns plan snapshot A
  - PUT with action=generate (2nd call): returns plan snapshot B
- Steps:
  1. Render → assert empty state visible, no day cards
  2. Set exam date, add topic → assert still empty state (no auto-gen)
  3. Click "Build Focus Plan" → assert plan A day cards visible, Generate button gone
  4. Change topic mastery → assert same plan A visible, "Regenerate Plan" button visible
  5. Click "Regenerate Plan" → assert plan B day cards visible, Regenerate button gone
- **Fails before**: Multiple components of this flow don't work (no Regenerate button, auto-regen exists)
- **Passes after**: All steps pass

### Acceptance Criteria
- [ ] Complete flow works end-to-end in unit test
- [ ] All 4 spec acceptance criteria verified in single test
- [ ] No regressions in existing DayCard/EmptyPlanState behavior

---

## Test File Setup Notes

The test file `tests/unit/components/StudyPlanPage.test.tsx` needs:

```typescript
// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'
```

**Mocks needed**:
- `global.fetch` — mock for API calls (GET plan, PUT generate)
- `next/navigation` — mock if needed (the component doesn't use it currently)
- `lucide-react` — may need to mock or let render as-is

**Helper**:
```typescript
const renderWithI18n = (locale: string = 'en') => {
  const messages = locale === 'he' ? heMessages : enMessages
  return render(
    <I18nProvider locale={locale} messages={messages}>
      <StudyPlanPage />
    </I18nProvider>
  )
}
```

---

## Summary of All Changes

| File | Type | Lines Changed | Description |
|------|------|---------------|-------------|
| `src/i18n/en.json` | MODIFIED | ~510 | Add `regenerateButton` key |
| `src/i18n/he.json` | MODIFIED | ~510 | Add `regenerateButton` key |
| `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` | MODIFIED | 64, 81, 94, 99, 110-127, 166, 206-217 | Remove auto-regen, add dirty state, add Regenerate button |
| `tests/unit/components/StudyPlanPage.test.tsx` | NEW | ~200 lines | All tests for FR-1 through FR-4 |

**Files NOT changed** (verified working as-is):
- `EmptyPlanState.tsx` — already correct
- `DayCard.tsx` — no changes needed
- `useStudyPlan.ts` — no changes needed (hook API stays the same)
- Engine/API route — no changes per spec scope

---

## Spec Requirement Traceability

| Requirement | Step | Test |
|-------------|------|------|
| FR-1: Empty state before generation | Step 4 | `should show empty state with Hebrew CTA text before Generate click` |
| FR-2: No auto-regeneration on input edits | Step 2 | `should NOT auto-regenerate when topics/date change` |
| FR-3: Dirty state tracking + Regenerate button | Steps 2+3 | `should show Regenerate button when inputs change after generation` |
| FR-4: Generate/Regenerate only path | Steps 2+3+5 | `full user flow: empty → generate → dirty → regenerate` |
