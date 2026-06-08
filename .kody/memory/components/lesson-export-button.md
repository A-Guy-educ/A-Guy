---
title: Lesson Export Button
type: component
updated: 2026-05-14
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1625
---

Admin action button that exports a lesson and its ordered exercises as JSON.

## What

Added `LessonExportButton` to `beforeDocumentControls` in the Lessons collection, triggering a browser file download of the lesson + exercises.

## Why

Allows admins to backup lessons offline with exercise content intact. Exports exercises in the same order they appear in the lesson's blocks array.

## Pattern

- API: `GET /api/lessons/:id/export` → Payload endpoint at `/lessons/:id/export`
- Admin button lives in `src/ui/admin/LessonExportButton/`
- Uses `beforeDocumentControls` hook in the Lessons collection config
- Response includes `Content-Disposition: attachment` header for browser download

## Response Shape

```json
{
  "lesson": { "id", "title", "slug", ... },
  "exercises": [{ "id", "title", "content", ... }],
  "meta": {
    "exerciseCount": 3,
    "missingExerciseRefs": [],
    "skippedNonExerciseBlocks": 1
  }
}
```

Exercises are ordered by the lesson's blocks array. Managed fields (`createdAt`, `updatedAt`, `id`) are stripped from exercise output.
