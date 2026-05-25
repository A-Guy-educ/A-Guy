# Fix: Remove " - Copy" suffix from lesson slug on duplication (issue #1904)

## What was fixed

**Root cause**: `deepCloneLesson` in `src/server/payload/endpoints/lessons/duplicate.ts` creates duplicate lessons with titles like `"Original Title - Copy"`. The `beforeChange` hook in `Lessons.ts` was passing this title directly to `formatSlugAsync`, producing ugly slugs like `original-title---copy` (triple hyphens) or `original-title-copy`.

**Fix**: Added a check in `Lessons.ts` beforeChange hook to strip ` - Copy` suffix from titles before slug generation:

```typescript
// BUG FIX (issue #1904): strip " - Copy" suffix before slug generation.
const cleanTitle = title?.endsWith(' - Copy') ? title.slice(0, -7) : title
data.slug = await formatSlugAsync(cleanTitle ?? '')
```

## Files changed

- `src/server/payload/collections/Lessons.ts` — added inline suffix stripping before slug generation
- `tests/int/lesson-duplication-none.int.spec.ts` — added repro test that asserts slugs don't contain " - Copy" / "copy" / "---"

## Test results

- Repro test passes (verified against real DB with MongoDB)
- All unit tests pass
- Typecheck clean
- Lint clean

## Why this approach

`stripCopySuffix` already existed in `formatSlug.ts` but was never wired into production code. The inline check was preferred over importing `stripCopySuffix` to keep the diff minimal and avoid unused-import lint errors. The inline check handles the exact Payload duplicate format (`" - Copy"` with leading space).
