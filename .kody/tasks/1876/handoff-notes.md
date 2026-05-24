# Fix for Issue #1876: Lesson Headings Misnumbered in Chapter 2

## What Was Done

Added deduplication of lesson IDs within each chapter group in `StudyContent` component.

## Root Cause

The `chapterGroups` useMemo builds groups by iterating through `filteredLessons`. If duplicate chapter entries exist in the chapters array, or if `chapter.lessons` contains duplicate entries, lessons would appear multiple times in a group. This causes the lesson count to be inflated, leading to incorrect `startIndex` calculations for subsequent chapters.

Example: If Chapter 1 lessons appear twice, Chapter 2's startIndex becomes 8 instead of 4, causing lessons to display as 4, 5 instead of 5, 6.

## Fix

Added deduplication filter in `StudyContent/index.tsx` after the chapterGroups loop:

```typescript
// Deduplicate lessons by ID within each group
for (const group of groups) {
  const seen = new Set<string>()
  group.lessons = group.lessons.filter((lesson) => {
    if (seen.has(lesson.id)) return false
    seen.add(lesson.id)
    return true
  })
}
```

## Files Changed

- `src/app/(frontend)/study/_components/StudyContent/index.tsx`: Added deduplication loop after chapterGroups construction

## Verification

- Typecheck passes
- Integration tests pass (practice-page-lesson-numbering.int.spec.ts)
- Quality gate passes