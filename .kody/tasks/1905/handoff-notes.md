## Bug #1905: Fix overlapping footer links at mobile viewport on Practice page

### What was fixed
The footer links ("Statistics & Performance" and "Upcoming Exam") on the `/practice` page were overlapping at 375px mobile viewport.

### Root cause
The footer wrapper div in `StudyContent/index.tsx` had a problematic CSS combination:
- `-mx-4 px-4` negative horizontal margin causing horizontal overflow at mobile viewport
- `p-content-gap-lg` (32px padding) causing the container to be wider than the viewport
- `rounded-2xl bg-gradient-to-b from-muted/10 to-transparent` decorative styling

This overflow broke the flex wrapping behavior, causing links to overlap instead of stacking.

### Files changed
- `src/app/(frontend)/study/_components/StudyContent/index.tsx` — removed problematic wrapper CSS, aligned with working `CoursePageContent` footer pattern
- `tests/e2e/practice-footer-mobile.e2e.spec.ts` — new E2E test validating no Y-axis overlap at 375px

### Fix applied
Aligned the `StudyContent` footer with the working `CoursePageContent` footer pattern:
- Removed decorative wrapper with negative margins and excessive padding
- Simplified to `mt-16 pt-8 border-t border-border` (matching CoursePageContent)
- Used `gap-content-gap-xs` and `duration-normal` consistently
