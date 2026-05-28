# #2175 — Lesson Exercises Editor (Admin Page)

## What was built

A new admin page at `/admin/lessons/[id]/exercises` that displays all exercises of a lesson in a single scrollable view with inline editing capability.

## Files created/modified

- **`src/app/(payload)/admin/lessons/[id]/exercises/page.tsx`** (new) — Client component that fetches lesson blocks to get exercise IDs, then fetches each exercise via REST API and renders them using `ExerciseRenderer` (student view). Edit mode toggles `InlineExerciseEditor` inline per exercise.

- **`src/ui/admin/LessonExercisesEditorButton/index.tsx`** (new) — Admin action button using `useDocumentInfo()` to get the lesson `id`, linked to `/admin/lessons/[id]/exercises`.

- **`src/server/payload/collections/Lessons.ts`** (modified) — Added `#LessonExercisesEditorButton` to the `beforeDocumentControls` array.

- **`tests/int/admin-lesson-exercises.int.spec.ts`** (new) — Unit tests for the `extractExerciseIdsFromBlocks` helper covering empty blocks, plain string IDs, populated relationship objects, mixed blocks, and null/undefined edge cases.

## Key patterns used

- `LessonExercisesEditorButton` follows the same pattern as `LessonExportAction` / `LessonDuplicationReviewLink` — uses `useDocumentInfo()` to get the lesson `id`.
- The page uses client-side REST API fetching (no server-side queries) since it's a `'use client'` component.
- `InlineExerciseEditor` already saves via `PATCH /api/exercises/:id` — no new API endpoints needed.
- Import map regenerated via `pnpm generate:importmap`.

## Verification

All quality gates pass (typecheck ✓, lint ✓, tests ✓).
