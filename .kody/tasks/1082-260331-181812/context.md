
### taskify (2026-03-31T18:21:27)
Based on my exploration of the codebase, here's the task classification:

```json
{
  "task_type": "feature",
  "title": "Add course lessons sorter component to admin course edit",
  "description": "Add a custom admin component in the course edit view that displays all lessons grouped by chapters, with drag-and-drop and up/down button sorting that updates each lesson's order field. Should appear above the meta field.",
  "scope": [
    "src/server/payload/collections/Courses.ts",
    "src/ui/adm
...(truncated)

### plan (2026-03-31T18:21:58)
Now I have enough context. Here's my implementation plan:

---

## Plan: Course Lessons Sorter Component

### Step 1: Create the CourseLessonsSorter UI component
**File:** `src/ui/admin/CourseLessonsSorter/index.tsx`
**Change:** Create new component that:
- Uses `useDocumentInfo` to get current course ID
- Fetches chapters (sorted by `order`) then lessons per chapter (sorted by `order`)
- Groups lessons by chapter
- Renders sortable list with drag-handle + up/down buttons (same pattern as `Lesso
...(truncated)

### build (2026-03-31T18:29:34)
Implementation complete. Here's a summary of the changes:

## Changes Made

### 1. Created API Route
**File:** `src/app/api/lessons/[id]/route.ts`
- PATCH endpoint for updating lesson order
- Admin-only access via role check
- Validates order is a non-negative integer

### 2. Created CourseLessonsSorter Component
**File:** `src/ui/admin/CourseLessonsSorter/index.tsx`
- Uses `useDocumentInfo` to get current course ID
- Fetches chapters sorted by `order`, then lessons per chapter
- Groups lessons 
...(truncated)

### review (2026-03-31T18:33:06)

## Verdict: FAIL

## Summary

This feature adds a `CourseLessonsSorter` UI component and a PATCH API endpoint to update lesson order. The implementation has one **critical authorization bug** where admin access check uses the wrong field name (`roles` instead of `role`), causing admin users to be rejected.

## Findings

### Critical

- `src/app/api/lessons/[id]/route.ts:49` — `user.roles?.includes('admin')` is incorrect. The `role` field is a string (`'admin'`), not an array. This means **no ad
...(truncated)

### review-fix (2026-03-31T18:33:41)
Fixed the critical authorization bug. Changed:
- `user.roles?.includes('admin')` → `user.role === 'admin'`
- `roles?: any[]` → `role?: any`

The Payload CMS `role` field is a string (`'admin'`), not an array, so the correct comparison is `user.role === 'admin'`.


### review (2026-03-31T18:34:15)
## Verdict: FAIL

## Summary

The critical authorization bug (`roles` vs `role`) has been fixed. The remaining issues are one **major** (broken revert on API failure) and one **minor** (missing transition styles on buttons, consistent with the existing `LessonBlocksField` pattern in the codebase).

## Findings

### Critical

None — the authorization bug has been resolved.

### Major

- `src/ui/admin/CourseLessonsSorter/index.tsx:190` — **Revert on failure is a no-op**. When the API call fails, `
...(truncated)

### review-fix (2026-03-31T18:34:57)
The Major revert bug is now fixed. Changes:
- Added `const previousChapters = chapters` before the optimistic update
- Changed `setChapters((prev) => prev)` to `setChapters(previousChapters)` in both the `!response.ok` and `catch` branches

This ensures the UI properly reverts to the previous state when the API call fails.


### review (2026-03-31T18:35:12)
## Verdict: PASS

## Summary

The critical authorization bug and the major revert-on-failure logic bug have both been fixed. The remaining issues are all **minor** and consistent with the existing `LessonBlocksField` pattern in the codebase — transitions on sort buttons and the `collection` guard on the admin check are omissions shared with sibling components, not new deviations.

## Findings

### Critical

None.

### Major

None.

### Minor

- `src/ui/admin/CourseLessonsSorter/index.tsx:373-404
...(truncated)
