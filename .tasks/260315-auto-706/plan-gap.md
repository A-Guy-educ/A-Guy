# Plan Gap Analysis: 260315-auto-706

## Summary

- Gaps Found: 1
- Plan Revised: Yes

## Gaps Identified

### Gap 1: `disabled` Button Prevents `onClick` From Firing — Toast Will Never Show

**Severity:** Critical
**Issue:** The plan specified using `<Button onClick={handleLessonClick} disabled className="cursor-not-allowed">` for locked ("Soon") lessons. However, this is contradictory:

1. A native HTML `<button disabled>` does NOT fire `onClick` events — this is standard browser behavior.
2. The Button component (`src/ui/web/components/button.tsx` line 7) applies `disabled:pointer-events-none` CSS, which additionally blocks all pointer interactions.
3. The spec (AC-2) explicitly requires: "Students cannot access 'Soon' content - clicking shows locked message" — the toast MUST fire on click.
4. The existing `CourseCard.test.tsx` (line 187) confirms this: `expect(toast.info).not.toHaveBeenCalled()` — CourseCard's `disabled` button intentionally does NOT show toast.

If the plan were implemented as-written, clicking a "Soon" lesson would do nothing — no toast, no feedback. This violates AC-2.

**Fix Applied:** Updated plan Steps 1 and 2:
- **Step 1**: Changed from `<Button disabled onClick={handler}>` to `<Button onClick={handler} className="cursor-not-allowed">` (no `disabled` attribute). The button remains clickable so the toast fires. Visual "locked" cue comes from `cursor-not-allowed` + Card's `opacity-60`.
- **Step 1 acceptance criteria**: Changed "disabled attribute present" to "Button is NOT disabled so onClick fires the toast"
- **Step 1 pattern reference**: Changed from CourseCard (which uses `disabled`) to CourseLessonCard (which uses `onClick` + `cursor-not-allowed`)
- **Step 2**: Removed the `button is disabled when lesson is "Soon"` test. Updated toast test to click `<button>` element via `getByRole('button')`.

## Spec Coverage Check

| Spec Requirement | Plan Step | Status |
|-----------------|-----------|--------|
| §1.1 "Soon" badge on Lesson card | Already implemented (prior runs) | ✅ Covered |
| §1.1 "Soon" content locked + message | Step 1 (conditional render, toast on click) | ✅ Covered |
| §1.2 "Just Added" badge on Lesson card | Already implemented (prior runs) | ✅ Covered |
| §1.2 "Just Added" fully accessible | Step 1 (Button asChild + SystemLink for non-soon) | ✅ Covered |
| §2.1 Admin fields | Already implemented (prior runs) | ✅ Covered |
| §3.1 Badge styling | Already implemented (prior runs) | ✅ Covered |
| §3.2 Pulse animation | Already implemented (prior runs) | ✅ Covered |
| AC-2 Students cannot access "Soon" + message | Step 1 (toast fires on click, no navigation) | ✅ Covered |
| AC-9 "New Until" date auto-removes badge | Already implemented (prior runs) | ✅ Covered |

## Reuse Corrections

No new reuse corrections needed. The plan correctly reuses all existing components and utilities.

## Feasibility Fixes

### Fix 1: `disabled` + `onClick` Conflict (described above)

**What was wrong:** Plan Step 1 specified `<Button disabled onClick={handler}>` expecting toast to fire — but disabled buttons don't fire click events.
**What was fixed:** Removed `disabled` prop. Use `cursor-not-allowed` CSS for visual cue instead. Button remains clickable so toast fires per spec.

### Fix 2: Test Structure Updated for Non-Disabled Button

**What was wrong:** Plan Step 2 added a `button is disabled when lesson is "Soon"` test — but button is no longer disabled.
**What was fixed:** Removed the disabled button test. Updated toast click test to use `getByRole('button')` instead of `getByTestId('system-link')`.

## Changes Made to Plan

- Updated Rerun Context: Removed reference to CourseCard `disabled` pattern as the target; clarified why `disabled` cannot be used with `onClick`
- Updated Patterns Observed: Added CRITICAL note about `disabled` preventing `onClick`
- Updated Step 1 exact behavior: `<Button onClick={handler} className="cursor-not-allowed">` instead of `<Button disabled onClick={handler}>`
- Updated Step 1 pattern reference: CourseLessonCard (not CourseCard) is the correct pattern
- Updated Step 1 HTML structure: Shows non-disabled `<button>` for locked state
- Updated Step 1 acceptance criteria: "Button is NOT disabled" instead of "disabled present"
- Updated Step 2: Removed disabled button test; updated toast test to click button element
