---
title: Exercise Sourcing from lesson.blocks
type: convention
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1474
  - src/server/services/lesson-context/prompt-composition.ts
---

# Exercise Sourcing from lesson.blocks

## Rule

**Always source exercises from `lesson.blocks[]`**, not from reverse `Exercise.lesson === lessonId` lookup.

## Why

The lesson page renders exercises in author-curated order from `lesson.blocks[]`. Chat must match this order for students to have consistent context.

Reverse lookup issues:
- Returns exercises in arbitrary MongoDB insertion order
- Includes orphan exercises not linked via blocks
- Includes draft/unpublished exercises
- Includes explanation pages (`הסבר 1`, `הסבר 2`) stored in `exercises` collection

## Implementation

`fetchExercisesFromLessonBlocks` helper:

1. Read `lesson.blocks` (textarea-stored JSON array)
2. Filter `blockType === 'exerciseRef'`
3. Collect `id` values in author-curated order
4. Bulk-fetch with `select: { id, title, content, _status }`
5. Drop drafts (`_status` set and not `published`)
6. Reorder client-side (Mongo `$in` doesn't preserve order)

```typescript
// WRONG: reverse lookup
const exercises = await payload.find({
  collection: 'exercises',
  where: { lesson: { equals: lessonId } },
})

// CORRECT: source from lesson.blocks
const exerciseIds = lesson.blocks
  .filter(b => b.blockType === 'exerciseRef')
  .map(b => b.id)
const exercises = await payload.find({
  collection: 'exercises',
  where: { id: { in: exerciseIds } },
})
```

## Known Limitation

The 31 exercises for `lesson-1` include two explanation pages (`הסבר 1`, `הסבר 2`) because they're stored as documents in the `exercises` collection. Distinguishing them requires a `kind` field on the content model.

## Related

- [chat-system-prompt-architecture](./chat-system-prompt-architecture.md)
