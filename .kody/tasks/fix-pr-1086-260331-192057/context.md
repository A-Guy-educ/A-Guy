
### build (2026-03-31T19:35:10)
The test failures are all due to the `DATABASE_URL` environment variable not being set in the test environment — not related to my code changes. 

**Summary of fix applied:**

Added `transition: 'opacity 0.15s'` to both the "Move up" and "Move down" sort buttons in `src/ui/admin/CourseLessonsSorter/index.tsx` (lines 384 and 401), matching the pattern used in `LessonBlocksField`.

**Verification:**
- Typecheck: ✅ Passes
- Lint: ✅ Passes  
- Test failures: Environment issue (missing `DATABASE_URL`
...(truncated)
