# Fix for Issue #2580: Lesson Duplications Table Relationship Cells Show Loading

## What Was Done

Added custom cell components for `sourceLesson` and `outputLesson` relationship fields in the `LessonDuplications` collection. The issue was that the default Payload relationship cell showed "Loading..." instead of lesson titles in the `/admin/lesson-duplications` list view.

## Root Cause

The root cause was not definitively identified. The default Payload relationship cell attempts to display the related document's title (using `useAsTitle` from the related collection). When this fails or times out, it shows "Loading...". This could be due to:
- List query using depth:0 which doesn't populate relationships
- Relationship values stored as string IDs rather than populated objects
- API call to fetch related document failing

## Changes Made

1. **src/server/payload/collections/LessonDuplications.ts**: Added `Cell` component configuration to both `sourceLesson` and `outputLesson` relationship fields

2. **src/ui/admin/LessonDuplicationReview/Cells/SourceLessonCell.tsx**: New custom cell component that:
   - Shows lesson title when relationship is populated as object with `title`
   - Shows truncated ID as fallback when only ID is available
   - Shows "—" when value is null/undefined

3. **src/ui/admin/LessonDuplicationReview/Cells/OutputLessonCell.tsx**: New custom cell component that:
   - Shows `<No Output Lesson>` when value is null (pending records)
   - Shows lesson title when relationship is populated
   - Shows truncated ID as fallback

4. **src/payload-types.ts**: Auto-regenerated after collection config change

## Verification

- TypeScript compilation: PASS
- ESLint: PASS (only pre-existing warning in unrelated file)
- Prettier format: PASS
- Quality gates: PASS

## Note

The custom cell components provide graceful fallback handling for both string IDs and populated objects. This follows the same pattern used in other custom cells in the project (e.g., `CategoriesCell`, `TransactionStatusCell`). The cells will display lesson titles when the relationships are properly populated in query results, and show truncated IDs as a fallback when only the ID is available.
