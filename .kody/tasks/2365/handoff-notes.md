# CI Fix: lesson-types int test failure

## What was failing

Test `rejects invalid lesson types` in `tests/int/lesson-types.int.spec.ts` was failing because the `validateLessonType` beforeChange hook was **normalizing** invalid types to `'learning'` instead of **rejecting** them.

## Root cause

The `validateLessonType` hook was converting any invalid/null type to `DEFAULT_LESSON_TYPE ('learning')` and returning data, causing the create operation to succeed when the test expected it to reject.

## What changed

Modified `validateLessonType` in `src/server/payload/collections/Lessons.ts` to:
- Reject explicitly invalid type values (`type` is set to a non-option string like `'invalid'`) by throwing an error
- Allow null/undefined types through (Payload's `defaultValue: 'learning'` handles those)

The `afterRead` hook still repairs existing lessons with null/invalid types on read, so legacy data is handled.

## Verification

All quality gates pass (typecheck, lint, integration tests).
