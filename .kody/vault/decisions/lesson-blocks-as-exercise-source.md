---
title: Lesson Blocks as Exercise Source
type: decision
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1474
  - https://github.com/A-Guy-educ/A-Guy/pull/1472 (audit F2 + F3)
---

# Lesson Blocks as Exercise Source

**Status:** Implemented — PR #1474

## Decision

Exercises shown to the chat model must be sourced from `lesson.blocks[]` (the block editor's JSON), not from a reverse `Exercise.lesson === lessonId` query.

## Rationale

The lesson page itself renders exercises in the order defined by `blocks[]`. The reverse lookup:
- Returns exercises in arbitrary MongoDB insertion order
- Includes orphan/draft exercises tagged with the lesson id
- Includes explanation pages stored in the `exercises` collection
- Returns a count that diverges from what students see (31 vs 29)

## Implementation

`fetchExercisesFromLessonBlocks` in `prompt-composition.ts`:

1. Reads `lesson.blocks` (stored as a JSON string in a textarea field)
2. Filters `blockType === 'exerciseRef'`
3. Collects ids in author-curated order
4. Bulk-fetches with `status: published` filter
5. Reorders client-side (Mongo `$in` does not preserve order)

## Caveats

The 31-entry count includes the two explanation pages (`הסבר 1`, `הסבר 2`) because they are documents in the `exercises` collection with `blockType: exerciseRef`. Distinguishing them requires a content-modeling change (e.g., a `kind` field on exercises) — tracked separately.

## Related

- [Chat System Architecture](../architecture/chat-system.md)
- [Audit doc: F2 + F3](https://github.com/A-Guy-educ/A-Guy/pull/1472)
