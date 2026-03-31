
### build (2026-03-31T21:16:11)
I've added `CourseLessonsSorter` to the import map. The component was missing from the import map, which is why Payload couldn't find and render it on the admin course edit page.

The fix is complete. After the dev server reloads, the `CourseLessonsSorter` component should now be visible on the admin course edit page.

**Summary of the fix:**
- **Root cause**: The `CourseLessonsSorter` component was added to the `Courses` collection config but was missing from the Payload admin import map (`src/
...(truncated)
