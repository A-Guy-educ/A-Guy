## Fix Summary

**Issue**: `/admin/lesson-duplications` list view showed "Loading..." for `sourceLesson` and `outputLesson` columns instead of lesson titles.

**Root Cause**: The Payload admin list view queries with `depth: 0` by default, so relationship fields return as unpopulated ID strings. The admin UI then attempts to fetch related lesson documents per-row to display titles (via `useAsTitle`), but these fetches either fail or never complete, resulting in a persistent "Loading..." state.

**Fix**: Added custom `Cell` components to the `sourceLesson` and `outputLesson` relationship fields in the `LessonDuplications` collection config. The `LessonDuplicationRelationshipCell` component handles three states:
1. Populated object (depth>=1): displays lesson title
2. ID string (depth=0): displays truncated ID as fallback
3. null: displays em-dash

**Files Changed**:
- `src/server/payload/collections/LessonDuplications.ts` — added `components.Cell` to both relationship fields
- `src/ui/admin/LessonDuplications/Cell/index.tsx` — new custom cell component
- `tests/int/lesson-duplication-admin-list.int.spec.ts` — new integration test verifying depth behavior
- `src/app/(payload)/admin/importMap.js` — regenerated to include new component
