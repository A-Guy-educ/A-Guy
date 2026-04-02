
### build (2026-04-02T19:34:35)
The fix is committed. Here's what was done:

**Root cause**: The `CourseLessonsSorter` field was placed *after* `courseContextText` — a textarea with a 100,000-character limit that renders as a very tall input. The component existed and was correctly wired up (importMap, collection config, component file all correct), but admins couldn't see it without scrolling past the massive textarea.

**Fix**: Moved the `lessonsSorter` UI field to appear right after `isActive` (near the top of the main cont
...(truncated)

### review (2026-04-02T19:39:18)
## Review: FAIL

### Major Issues

1. **Incomplete order persistence** (`CourseLessonsSorter/index.tsx:176-196`): When moving a lesson, only the moved lesson's `order` is saved to the database. The displaced lesson retains its old order value. After page refresh, two lessons can share the same `order`, causing unpredictable sorting. Both affected lessons (or all lessons in the chapter) need their orders updated.

2. **Error details leak** (`api/lessons/[id]/route.ts:106-113`): The 500 response r
...(truncated)

### review-fix (2026-04-02T19:41:20)
Both issues fixed:

1. **Order persistence** (`CourseLessonsSorter/index.tsx`): Now compares original orders by ID against the new sequential orders, then PATCHes all lessons that changed — not just the one that moved. Prevents duplicate `order` values after a swap.

2. **Error detail leak** (`api/lessons/[id]/route.ts`): Removed `details: error.message` from the 500 response. Server-side `console.error` is kept for debugging.

