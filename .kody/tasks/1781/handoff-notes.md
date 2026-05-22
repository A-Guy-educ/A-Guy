# Issue #1781: Mobile horizontal scroll in lessons — fix

## What was fixed

Three changes to eliminate horizontal overflow on mobile (< 640px) in lesson/exercise views:

### 1. GraphWithPrompt responsive breakpoints (`src/ui/web/exerciserenderer/blocks/GraphWithPrompt/index.tsx`)
- `getLayoutClasses()` was returning `'flex flex-row'` unconditionally for `textLeft`/`textRight` in interactive mode (no worksheetLayout)
- Changed to `'flex flex-col sm:flex-row'` — stacks vertically on mobile, side-by-side at `sm` (640px+)
- Updated file header comment to reflect new behavior

### 2. JSXGraphBoard inline width removal (`src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx`)
- Removed `width` and `height` from the inline `style={{ width, height, maxWidth: '100%' }}` prop on the container div
- Kept `maxWidth: '100%'` only — lets the container shrink naturally via CSS `w-full`
- The `ResizeObserver` in `AxisRenderer` already drives the actual canvas size via ref; the inline width/height was redundant and forced the container wider than the viewport
- Prefixed unused props with `_width`/`_height` to satisfy linter

### 3. overflow-x-hidden guards (`LessonPager/index.tsx`, `ExercisesPager/index.tsx`)
- Added `overflow-x-hidden` to the scroll container divs (`contentRef`) in both lesson and exercise views
- This is a belt-and-suspenders guard: if any block renders wider than the viewport, it won't cause page-level horizontal scroll

## Tests updated
- `tests/unit/exerciserenderer/blocks/GraphWithPrompt.test.tsx` — new test file with 6 tests covering mobile-first responsive behavior
- `tests/unit/ui/graph-with-prompt.test.tsx` — updated 4 existing tests that asserted the OLD (buggy) non-responsive behavior; now assert the correct `flex-col sm:flex-row` behavior

## Files changed
- `src/ui/web/exerciserenderer/blocks/GraphWithPrompt/index.tsx` — layout classes fix
- `src/ui/web/exerciserenderer/graphics/JSXGraphBoard.tsx` — inline width removal
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonPager/index.tsx` — overflow-x-hidden
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` — overflow-x-hidden
