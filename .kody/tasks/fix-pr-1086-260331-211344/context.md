
### build (2026-03-31T21:16:11)
I've added `CourseLessonsSorter` to the import map. The component was missing from the import map, which is why Payload couldn't find and render it on the admin course edit page.

The fix is complete. After the dev server reloads, the `CourseLessonsSorter` component should now be visible on the admin course edit page.

**Summary of the fix:**
- **Root cause**: The `CourseLessonsSorter` component was added to the `Courses` collection config but was missing from the Payload admin import map (`src/
...(truncated)

### review (2026-03-31T21:19:22)
Based on my review of the diff, I can now provide the structured code review.

## Verdict: FAIL

## Summary

This PR adds the `CourseLessonsSorter` component to the admin course edit page with sort buttons that have `transition: 'opacity 0.15s'`. The human feedback indicates the component is still not visible on the admin course edit page. There are several issues that need to be addressed.

## Findings

### Critical

None.

### Major

- `src/ui/admin/CourseLessonsSorter/index.tsx:190` — Revert 
...(truncated)

### review-fix (2026-03-31T21:25:54)
All Major issues have been fixed:

**Summary of fixes:**

1. **Revert on failure (lines 159, 193, 198)**: Added `chaptersBeforeMove` variable to save the state before the optimistic update, and used it to properly revert on failure (both in the `if (!response.ok)` branch and the `catch` branch).

2. **Transition property (lines 389, 406)**: Changed `transition: 'opacity 0.15s'` to `transition: 'all 0.2s'` to comply with the design system requirement that all interactive elements have transitions
...(truncated)

### review (2026-03-31T21:26:47)
Based on my review of the current working tree state, all Major issues from the previous review have been addressed.

## Verdict: PASS

## Summary

This PR adds the `CourseLessonsSorter` component to the admin course edit page, enabling admins to view and reorder lessons within chapters. The component includes proper optimistic update handling with correct revert-on-failure behavior, and buttons have appropriate transitions.

## Findings

### Critical

None.

### Major

None. All previously iden
...(truncated)

### review-fix (2026-03-31T21:27:01)
The review has passed (Verdict: PASS). All Major issues identified in the previous review have been addressed:

**Fixes applied:**

1. **Revert on failure** — Added `chaptersBeforeMove` variable to properly save and restore state on API failure (lines 159, 193, 198)

2. **Transition property** — Changed `transition: 'opacity 0.15s'` to `transition: 'all 0.2s'` (equivalent to `transition-all duration-normal`) on both buttons (lines 389, 406)

3. **Trailing newline** — Added missing newline at end
...(truncated)
