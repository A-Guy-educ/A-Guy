
### build (2026-04-02T19:34:35)
The fix is committed. Here's what was done:

**Root cause**: The `CourseLessonsSorter` field was placed *after* `courseContextText` — a textarea with a 100,000-character limit that renders as a very tall input. The component existed and was correctly wired up (importMap, collection config, component file all correct), but admins couldn't see it without scrolling past the massive textarea.

**Fix**: Moved the `lessonsSorter` UI field to appear right after `isActive` (near the top of the main cont
...(truncated)
