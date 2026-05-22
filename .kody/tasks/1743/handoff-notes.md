# Issue #1743 Fix: Hide Prev/Next Navigation Until 85% Scroll

## What was done

Implemented scroll-based navigation visibility in both `LessonPager` and `ExercisesPager`:

1. **Added scroll tracking state** (`isAt85Percent`) in both components
2. **Added scroll event listener** that calculates scroll percentage and shows navigation when >= 85%
3. **Replaced full navigation bar** with small centered arrow buttons (‹ ›) that only appear at 85% scroll
4. **Fixed React hooks ordering** - `contentRef` must be declared BEFORE any effects that use it (this was a bug introduced during implementation)

## Files changed

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonPager/index.tsx`
  - Added `isAt85Percent` state and scroll tracking effect
  - Navigation bar now conditionally renders small arrows at 85% scroll
  - Fixed hooks ordering to put `contentRef` before scroll effect

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`
  - Same changes as LessonPager
  - Fixed hooks ordering issue

- `tests/unit/ui/lesson-navigation-scroll-visibility.test.tsx`
  - New test file with scroll percentage calculation tests

## Known gaps (from followups.json)

1. Chat button shift to center not implemented - requires deeper component hierarchy changes
2. PDF viewer section still shows full navigation bar (not changed)

## Verification

- TypeScript check: passes
- Lint: passes
- Unit tests: 10/10 pass