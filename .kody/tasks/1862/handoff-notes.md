## Fix for #1862: Chapter 2 lesson card labels off-by-one

### Root Cause
The `chapterGroups` deduplication in `StudyContent` uses a Map keyed by `chapterSlug`. This guards against duplicate chapter entries adding lessons to the wrong group, but does NOT guard against the same lesson appearing twice in `filteredLessons` (e.g., from a duplicate chapter in the chapters array or duplicate entries in `chapter.lessons`).

When a lesson appears twice, two cards render with the same `index`, causing duplicate labels (e.g., "Lesson 4" appearing twice).

### Fix
Added Set-based deduplication by lesson ID at the end of the `chapterGroups` useMemo in `src/app/(frontend)/study/_components/StudyContent/index.tsx`.

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

### Files Changed
- `src/app/(frontend)/study/_components/StudyContent/index.tsx` — Added lesson ID deduplication
- `tests/int/chapter-lesson-index-sequential.int.spec.ts` — New integration test with 4 test cases covering normal case, duplicate detection, sequential index computation, and deduplication safeguard
