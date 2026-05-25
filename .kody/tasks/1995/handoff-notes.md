## Bug Fix: Lesson Duplications Row Links Wrong URL

**Root cause**: The `LessonDuplications` collection had no `admin.formatDocURL` override, so Payload generated row links at `/admin/collections/lesson-duplications/:id` (the default for a collection with slug `lesson-duplications`). The custom review UI lives at `/admin/lesson-duplications/:id`.

**Files changed**:

1. `src/server/payload/collections/LessonDuplications.ts` — Added `formatDocURL` admin option that returns `/admin/lesson-duplications/${doc.id}` for all row links
2. `src/app/(payload)/admin/lesson-duplications/page.tsx` — Fixed redirect from `/admin/collections/lesson-duplications` to `/admin/lesson-duplications`
3. `src/ui/admin/LessonDuplicationReview/index.tsx` — Updated 3 hardcoded "Back to list" links from `/admin/collections/lesson-duplications` to `/admin/lesson-duplications`
4. `tests/e2e/lesson-duplications-list-row-links.e2e.spec.ts` — New E2E test (requires running dev server to execute)
