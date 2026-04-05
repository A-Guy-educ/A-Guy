
### taskify (2026-04-05T14:03:25)
Done. I made the following changes to `src/server/payload/collections/Courses.ts`:

1. **Added `chapterCount` field** (lines 292-300) - A hidden number field that stores the computed chapter count

2. **Added `afterRead` hook** (lines 48-72) - Queries the `chapters` collection to count how many chapters belong to each course and populates the `chapterCount` field

3. **Added `chapterCount` to `defaultColumns`** (line 94) - The chapter count column will now appear in the admin list view

The `sta
...(truncated)

### build (2026-04-05T14:22:39)
Noted. The implementation is complete.

