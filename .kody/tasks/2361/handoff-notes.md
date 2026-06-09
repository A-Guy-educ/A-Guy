# Issue #2361: Lesson Type field is blank in edit form

## What I did

**Root cause**: The `type` select field in the Lessons collection had no defensive validation to ensure the field is always set to a valid value. Legacy lessons created before certain schema changes might have null/invalid type values, causing the admin form's select to show blank (since null doesn't match any of the three valid options: 'learning', 'practice', 'exam').

**Fix**: Added two hooks to `src/server/payload/collections/Lessons.ts`:

1. **`validateLessonType` (beforeChange hook)**: Ensures the `type` field is always set to 'learning' if null/undefined/invalid during create or update operations.

2. **Type fix (afterRead hook)**: On read, if the `type` field is null/undefined/invalid, it sets it to 'learning' and persists the fix to the database (when user context is available). This ensures existing lessons with bad type values are corrected on first read.

## Files changed

- `src/server/payload/collections/Lessons.ts`: Added `VALID_LESSON_TYPES`, `DEFAULT_LESSON_TYPE` constants, `validateLessonType` beforeChange hook, and type-fix afterRead hook.
- `tests/int/lesson-types.int.spec.ts`: Added test case `'retrieves lesson type correctly by ID (admin edit form simulation)'` to verify data layer correctness.

## Test results

- All lesson-types tests pass (6 tests)
- TypeScript typecheck passes
- Lint passes
- All quality gates green