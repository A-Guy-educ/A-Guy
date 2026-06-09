# Fix for #2553: Courses page loads broken lesson reference causing 404

## What was wrong

The `Chapters` collection had no `afterDelete` hook. When a chapter was deleted via Payload's standard `delete()` call (bypassing the `/api/cascade-delete` custom endpoint), its related lessons remained in the database with a stale `chapter` reference. This caused 404 errors when anything tried to fetch those orphaned lessons by ID.

Similarly, the `Lessons` collection had no `afterDelete` hook, so `LessonDuplications` records referencing a deleted lesson were left orphaned.

## What was changed

1. **New file**: `src/server/payload/hooks/chapters/cascadeDeleteLessons.ts`
   - `afterDelete` hook on the `Chapters` collection
   - Finds all lessons where `chapter == deletedChapterId` and deletes them
   - This also triggers the Exercises `afterDelete` hook to clean up exercise blocks

2. **New file**: `src/server/payload/hooks/lessons/cleanupOrphanLessonDuplications.ts`
   - `afterDelete` hook on the `Lessons` collection
   - Deletes any `LessonDuplications` records where the deleted lesson is `sourceLesson` or `outputLesson`

3. **Modified**: `src/server/payload/collections/Chapters.ts`
   - Added `afterDelete: [cascadeDeleteLessons]` to the hooks config
   - Imported `cascadeDeleteLessons` from the new hook file

4. **Modified**: `src/server/payload/collections/Lessons.ts`
   - Added `afterDelete: [cleanupOrphanLessonDuplications]` to the hooks config
   - Imported `cleanupOrphanLessonDuplications` from the new hook file

5. **New file**: `tests/int/chapter-lesson-cascade-delete.int.spec.ts`
   - Integration test verifying that lessons are deleted when chapter is deleted via standard Payload delete
   - Both tests pass after the fix

## Verification

- TypeScript: passes (`npx tsc --noEmit`)
- Lint: passes (only pre-existing warning in LatexDocumentViewer)
- Integration test: `tests/int/chapter-lesson-cascade-delete.int.spec.ts` — 2 tests pass, confirmed the cascade delete log messages appear
- Related tests: `tests/int/course-entitlement-cascade-delete.int.spec.ts` — 5 tests pass (no regression)

## Follow-up (not done)

- Consider adding a `cascadeDeleteChapters` afterDelete hook to Courses for the same reason
- Pre-existing broken integration tests (lesson-query-hierarchy-safety, etc.) need MongoDB container setup
