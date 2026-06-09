## Fix: lesson-duplications table relationship cells show "Loading..." instead of titles

### What was wrong
The `/admin/collections/lesson-duplications` list view showed "Loading..." in the Source Lesson and Output Lesson columns for all rows.

### Root cause
The `sourceLesson` and `outputLesson` relationship fields had no custom Cell components, so Payload used its default `RelationshipCell`. That cell attempts to asynchronously fetch each related lesson's `useAsTitle` field for every row — a request that fails silently in the list context, leaving the cell stuck on "Loading...".

### What was changed
1. **New: `src/ui/admin/LessonDuplications/Cells/SourceLessonCell/index.tsx`** — renders lesson title (or ID) directly from `cellData`/`fieldData` (the populated relationship from the list query at depth=2).

2. **New: `src/ui/admin/LessonDuplications/Cells/OutputLessonCell/index.tsx`** — same pattern; renders title or `<No Output Lesson>` when null.

3. **Updated: `src/server/payload/collections/LessonDuplications.ts`** — wired `SourceLessonCell` and `OutputLessonCell` into the `admin.components.Cell` of the `sourceLesson` and `outputLesson` fields respectively.

4. **New: `tests/int/lesson-duplications-list-relationship-cells.int.spec.ts`** — integration test verifying that list queries with `depth=2` properly populate both relationships with title data, and that null outputLesson is handled correctly.

### How to verify
Navigate to `/admin/collections/lesson-duplications` and confirm Source Lesson and Output Lesson columns show lesson titles (or `<No Output Lesson>` for pending records with no output).
