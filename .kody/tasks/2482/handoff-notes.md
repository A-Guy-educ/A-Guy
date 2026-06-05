# Task 2482: Admin Lesson Duplications list — relationship cells Loading...

## What was done

**Root cause**: Payload's default relationship cell makes an extra API call to `/api/lessons/:id` for each row to fetch the related lesson title. If any of these calls fail (network timeout, access control edge case, etc.), the cell shows "Loading..." indefinitely.

**Fix**: Created custom `LessonRelationshipCell` React component that displays the lesson title directly from the populated `cellData` prop (available when the list query uses `depth=1`), bypassing the extra API call.

## Files changed

1. **New file**: `src/ui/admin/LessonDuplications/Cells/LessonRelationshipCell.tsx`
   - Custom cell component that renders lesson title (when populated) or truncated ID (fallback)

2. **Modified**: `src/server/payload/collections/LessonDuplications.ts`
   - Added `admin.components.Cell` to both `sourceLesson` and `outputLesson` relationship fields

3. **New file**: `tests/int/lesson-duplications-list-relationships.int.spec.ts`
   - Integration test verifying relationships are properly populated with depth=1

## Verification

- Typecheck: PASSED
- Lint: PASSED (pre-existing warning unrelated to this change)
- Integration test: 4/4 PASSED
- Quality gates: PASSED (verify tool)
