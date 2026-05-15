---
title: Lesson Export
type: architecture
updated: 2026-05-15
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1625
---

## Overview

Lessons and their ordered exercises can be exported as JSON from the admin panel. Useful for backups, offline review, and migration.

## Endpoint

**GET /api/lessons/:id/export** — Admin-only (401 unauthenticated, 403 non-admin).

Response: `Content-Type: application/json` with `Content-Disposition: attachment; filename="<slug>.json"`.

## JSON Shape

```typescript
{
  lesson: { id, title, slug, description, type, status, order, ... }, // managed fields stripped
  exercises: [ { id, title, slug, content, origin, ... }, ... ],       // ordered by blocks array
  meta: {
    exerciseCount: number,
    missingExerciseRefs: string[],      // IDs in blocks but not in DB
    skippedNonExerciseBlocks: number,   // contentPageRef etc.
  }
}
```

## Behavior

- Exercises appear in the same order as the lesson's `blocks` array
- Only `exerciseRef` blocks are followed; `contentPageRef` and other types are counted but skipped
- Missing exercise references are listed in `meta.missingExerciseRefs`
- `createdAt`, `updatedAt` are stripped from both lesson and exercises; `id` is preserved

## Architecture

- `src/server/payload/endpoints/lessons/export.ts` — Payload endpoint (core logic)
- `src/app/api/lessons/[id]/export/route.ts` — App Router wrapper (sets headers)
- `src/ui/admin/LessonExportButton/LessonExportButton.tsx` — Admin button in beforeDocumentControls
- `tests/int/lesson-export.int.spec.ts` — Integration tests

## Related

- [lesson-duplication](./lesson-duplication.md) — Related lesson management features
