# Fix: Lesson Heading Off-by-One in Practice Page Chapter 2

## Bug
On `/practice` page, Chapter 2 lesson cards displayed mismatched badge/title (e.g., badge showed "Lesson 5" but card heading showed "Lesson 4"). The sequential numbering was correct but the database `lesson.title` field was stale.

## Root Cause
`CourseLessonCard` used `lesson.title` directly for the card heading, but the badge was computed from the `index` prop using the correct sequential numbering formula (`startIndex + idx + 1`). When lessons were reordered or had incorrect titles in the database, the heading appeared off-by-one compared to the badge.

## Fix
Modified `src/ui/web/components/UnifiedCard/CourseLessonCard.tsx` to derive the displayed `title` from the same `index` prop used for the badge, ensuring they always match.

```typescript
// Before:
title={lesson.title}

// After:
const title = `${isExam ? tc('exam') : tc('lesson')} ${index}`
title={title}
```

## Files Changed
- `src/ui/web/components/UnifiedCard/CourseLessonCard.tsx` - Changed title to use index-based derivation
- `tests/unit/components/CourseLessonCard.test.tsx` - Updated tests to reflect new behavior (title and badge both show same value)
- `tests/unit/components/practice-lesson-index.test.tsx` - New test file verifying index calculation logic

## Tests
All unit tests pass. The `practice-lesson-index.test.tsx` confirms the index calculation formula works correctly: `startIndex + idx + 1` where `startIndex = sum of lessons in previous chapter groups`.

## Trade-off
The fix ensures consistency between badge and title at the cost of not displaying the actual `lesson.title` from the database. If lessons have meaningful titles beyond "Lesson N", this could be a regression - flagged as low priority followup.
