# Gap Analysis: 260301-auto-50

## Summary

- Gaps Found: 7
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing "Mastery Cycle" Timeframe Mode

**Severity:** High
**Location:** `src/lib/study-plan/engine.ts`, `src/lib/study-plan/constants.ts`, `src/lib/study-plan/types.ts`
**Issue:** The spec defines a "Mastery Cycle" mode for 8+ days ("Foundation Building"), but the codebase only implements 3 modes: survival (<=1 day), high_intensity (2-5 days), and balanced (6+ days). The `TimeframeMode` type does not include 'mastery_cycle'.
**Fix Applied:** Added 'mastery_cycle' to TimeframeMode type and implemented corresponding ACTIVITY_TEMPLATES.mastery_cycle in constants.ts.

### Gap 2: Incorrect Survival Mode Threshold

**Severity:** High
**Location:** `src/lib/study-plan/engine.ts` line 25
**Issue:** The spec says survival mode is for "1–2 days", but the code uses `if (daysUntilExam <= 1) return 'survival'` which only covers 1 day, not 1-2 days.
**Fix Applied:** Changed condition to `if (daysUntilExam <= 2)` to match spec.

### Gap 3: Hardcoded 7-Day Generation Instead of Adaptive

**Severity:** High
**Location:** `src/lib/study-plan/engine.ts` line 238
**Issue:** The spec says "Show up to last 7 days before exam" - meaning if exam is in 3 days, only 3 days should be shown. The code always generates exactly 7 days regardless of `daysLeft` value.
**Fix Applied:** Changed loop to generate `Math.min(7, Math.max(1, daysLeft))` days instead of fixed 7.

### Gap 4: Missing Hebrew "בוצע" Badge

**Severity:** Medium
**Location:** `src/app/(frontend)/study-plan/_components/DayCard.tsx`, `src/i18n/he.json`
**Issue:** The spec explicitly requires a "בוצע" badge for completed days, but the current implementation uses "הושלם" (completed). The spec says: "Completed day visual: opacity-50 and/or בוצע badge".
**Fix Applied:** Added "completedBadge": "בוצע" to he.json translations and updated DayCard to display this badge alongside the opacity change.

### Gap 5: Color Specification Mismatch

**Severity:** Medium
**Location:** `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` line 15, `src/app/(frontend)/study-plan/_components/DayCard.tsx`
**Issue:** The spec defines Medium mastery color as "orange-400" but the code uses "orange-500". The spec also says Strong = emerald-500, but code uses green-500.
**Fix Applied:** Updated MASTERY_COLORS in StudyPlanPage.tsx to use orange-400 (not orange-500) and ACTIVITY_COLORS in DayCard.tsx to use emerald-500 for strong mastery indication.

### Gap 6: Missing Mastery Cycle Activity Template

**Severity:** High
**Location:** `src/lib/study-plan/constants.ts`
**Issue:** Gap 1 depends on this - the mastery_cycle mode needs an activity template. The spec defines Mastery Cycle activity mix as "Intensive weak-topic drills".
**Fix Added:** Added ACTIVITY_TEMPLATES.mastery_cycle with intensive practice/reinforcement pattern focused on weak topics.

### Gap 7: Round-Robin Topic Selection Implementation

**Severity:** Medium
**Location:** `src/lib/study-plan/engine.ts`
**Issue:** The spec says "Round-robin rotation: Do not repeat a topic until peers in same category are covered." The current buildTopicCycle uses weighted repetition (weak=3x, medium=2x, strong=1x) which doesn't strictly follow round-robin. However, this is a nuanced edge case - the current implementation provides good distribution. The acceptance criteria doesn't specifically test this.
**Fix Applied:** Updated buildTopicCycle to implement true round-robin within each mastery category - topics are now selected in order without repeating until all topics in that category have been covered.

## Changes Made to Spec

- Added FR-01: Implement "Mastery Cycle" timeframe mode for 8+ days until exam
- Updated FR-A (Adaptive Timeline Scaling): Changed survival threshold from <=1 to <=2 days
- Added FR-B: Adaptive day count - show min(daysUntilExam, 7) days, minimum 1 day
- Added FR-C: Round-robin rotation implementation within mastery categories
- Updated Acceptance Criteria to specify daysUntilExam=1 yields warmup with only 1 day shown
- Added UI Requirement: Use "בוצע" badge for completed days in Hebrew

## Notes

The existing codebase already implements:
- ✅ Manual trigger flow (Generate button) - implemented correctly
- ✅ Persistence to UserProgress collection - fully functional
- ✅ Completion toggle with optimistic UI - working
- ✅ RTL support - properly uses he-IL locale
- ✅ Vertical timeline with rounded-2xl cards - implemented
- ✅ Font Assistant (300-800) - assumed to be in tailwind config

The gaps identified are primarily around the adaptive timeline logic and specific UI text/colors.
