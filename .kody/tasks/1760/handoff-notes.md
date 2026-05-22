# Task 1760: Two-Column Worksheet Layout for Lesson Edit Page

## What was done

Created a new `LessonExerciseEditorLayout` custom edit view for the Lessons collection that implements a two-column worksheet layout:

**New file:** `src/ui/admin/LessonExerciseEditor/index.tsx`
- `LessonExerciseEditor` component: Displays lesson blocks as an expandable worksheet — each block row can be clicked to expand and show the full exercise content rendered via `ExerciseWorksheet` (read-only, worksheet-style). Drag-and-drop reordering is preserved from `LessonBlocksField`.
- `LessonExerciseEditorLayout` component: Two-column layout (65% left / 35% right) with:
  - Left: `LessonExerciseEditor` (scrollable worksheet)
  - Right: Read-only metadata fields (order, status, contentFiles, lessonContextText)
  - Header showing "פרק / שיעור → תרגילים" (chapter title / lesson title → exercises)
- `DefaultEditView` is still called at the bottom to render remaining Payload-managed fields

**Updated:** `src/server/payload/collections/Lessons.ts`
- Added `views.edit.Default.Component` pointing to `LessonExerciseEditorLayout`
- `blocks` field: `hidden: true` (rendered by the custom view instead)
- `contextExerciseViewer` field: commented out (replaced by worksheet view)
- `conversionPanel` kept as-is (still useful for PDF conversion)

## Notes
- The right column fields are read-only display — they use `useField` to read values but don't override Payload's form rendering
- The `LessonBlocksField` component still exists but is no longer used in the Lessons collection config
- The header dynamically fetches the chapter title to build the full breadcrumb text
- `ExerciseWorksheet` is rendered with `hideLatexBlocks={false}` so LaTeX is visible in the worksheet view

## Fix Round (2026-05-22)

**Root Cause:** The `LessonExerciseEditorLayout` component was NOT in the Payload admin import map (`src/app/(payload)/admin/importMap.js`). This meant Payload CMS could not resolve the path `@/ui/admin/LessonExerciseEditor#LessonExerciseEditorLayout` specified in `views.edit.Default.Component`, causing the component to silently fail to load (preview showed no change).

**Fix Applied:** Ran `pnpm generate:importmap` to regenerate the import map. The import map now includes:
```
"@/ui/admin/LessonExerciseEditor#LessonExerciseEditorLayout": LessonExerciseEditorLayout_ae6d4dbf332bf3db3251a54fed0e8636
```

**Verification:**
- TypeScript: `tsc --noEmit` passes with no errors
- ESLint: passes (no errors in modified files)
- Import map: `LessonExerciseEditorLayout` now correctly registered

**Key lesson:** When adding new admin UI component directories, always run `pnpm generate:importmap` to register them with Payload's component loader. The `Products.ts` collection follows the same `views.edit.Default.Component` pattern and serves as a reference for correct usage.
