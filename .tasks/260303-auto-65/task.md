# Task

## Issue Title

Refactor: Duplicated formatSlug function across 3 collections lacks Hebrew support
## Description

The `formatSlug` function is copy-pasted identically in Courses, Chapters, and Lessons collections as a simple regex-based implementation. Meanwhile, the Exercises collection has a proper `formatSlug` in its own file that uses the `slugify` library with Hebrew locale support (`locale: 'he'`), strict mode, and fallback behavior.

The inline versions use `[^\w-]+` regex which **strips Hebrew characters**, which is critical for an Israeli educational platform where titles are in Hebrew.

## Current Behavior

```typescript
// Courses.ts, Chapters.ts, Lessons.ts — identical copy-paste
const formatSlug = (val: string): string =>
  val.replace(/ /g, '-').replace(/[^\w-]+/g, '').toLowerCase()
```

This strips Hebrew characters entirely, producing empty or broken slugs for Hebrew titles.

## Expected Behavior

Extract the Exercises' robust `formatSlug` implementation (which uses `slugify` with Hebrew locale) into a shared utility:

```
src/server/payload/fields/formatSlug.ts  (shared utility)
```

Then import it in all four collections for consistent Hebrew-safe slug generation.

## Files to Change

- `src/server/payload/collections/Courses.ts` — remove inline formatSlug, import shared
- `src/server/payload/collections/Chapters.ts` — remove inline formatSlug, import shared
- `src/server/payload/collections/Lessons.ts` — remove inline formatSlug, import shared
- `src/server/payload/collections/Exercises/formatSlug.ts` — reference implementation
- Create: `src/server/payload/fields/formatSlug.ts` — shared utility

## Complexity

Medium — 4 files to modify, 1 new utility file to create. Requires ensuring all existing slugs remain valid.

## Labels

refactor, i18n
