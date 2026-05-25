# Fix Lesson Card Headings and Chapter Heading (Issue #1903)

## Changes Made

### 1. Lesson Ordering Fix (src/server/repos/queries/study-page.ts)
Added sorting of lessons within each chapter by their `order` field after grouping. This ensures correct ordering even if the database returns lessons interleaved due to global `sort: 'order'` query.

```typescript
Object.keys(lessonsByChapter).forEach((chapterId) => {
  lessonsByChapter[chapterId].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})
```

This follows the same pattern already implemented in `queryLessonsByCourse` in `src/server/repos/queries/lessons.ts`.

### 2. Chapter Heading Spacing Fix (src/app/(frontend)/study/_components/StudyContent/index.tsx)
Added literal space inside the chapterLabel span to ensure proper spacing between label and title:

```tsx
{group.chapterLabel && (
  <span className="...">
    {group.chapterLabel}{' '}
  </span>
)}
```

## Test Added
- `tests/unit/queries/study-page-lesson-order.test.ts` - Tests that lessons within each chapter are sorted by their `order` field after grouping, even when database returns them interleaved.

## Verification
- All 50 unit tests pass
- Typecheck passes
- Quality gates (verify tool) pass